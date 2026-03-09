import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from './audit.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  // ============================================================
  // FIND ACTIVE RULE FOR ENTITY + TRIGGER
  // ============================================================
  async findActiveRule(
    schemaName: string,
    entityType: string,
    triggerEvent: string,
  ): Promise<any | null> {
    const rows = await this.dataSource.query(
      `SELECT
         r.id, r.name, r.entity_type, r.trigger_event, r.conditions,
         json_agg(
           json_build_object(
             'id', s.id,
             'stepOrder', s.step_order,
             'approverType', s.approver_type,
             'approverUserId', s.approver_user_id,
             'approverRoleId', s.approver_role_id
           ) ORDER BY s.step_order
         ) AS steps
       FROM "${schemaName}".approval_rules r
       LEFT JOIN "${schemaName}".approval_rule_steps s ON s.rule_id = r.id
       WHERE r.entity_type = $1
         AND r.trigger_event = $2
         AND r.is_active = true
         AND r.deleted_at IS NULL
       GROUP BY r.id
       LIMIT 1`,
      [entityType, triggerEvent],
    );

    if (!rows.length) return null;

    const rule = rows[0];
    return {
      id: rule.id,
      name: rule.name,
      entityType: rule.entity_type,
      triggerEvent: rule.trigger_event,
      conditions: rule.conditions,
      steps: rule.steps && rule.steps[0]?.id ? rule.steps : [],
    };
  }

  // ============================================================
  // CREATE APPROVAL REQUEST
  // ============================================================
  async createRequest(
    schemaName: string,
    entityType: string,
    entityId: string,
    triggerEvent: string,
    requestedBy: string,
  ): Promise<any | null> {
    const rule = await this.findActiveRule(
      schemaName,
      entityType,
      triggerEvent,
    );
    if (!rule) return null;

    // Check for existing pending request
    const existing = await this.dataSource.query(
      `SELECT r.id, r.current_step,
              COALESCE(au.first_name || ' ' || au.last_name, rl.name) AS approver_name
       FROM "${schemaName}".approval_requests r
       LEFT JOIN "${schemaName}".approval_request_steps s
         ON s.request_id = r.id AND s.step_order = r.current_step
       LEFT JOIN "${schemaName}".users au ON au.id = s.approver_user_id
       LEFT JOIN "${schemaName}".roles rl ON rl.id = s.approver_role_id
       WHERE r.entity_type = $1 AND r.entity_id = $2
         AND r.trigger_event = $3 AND r.status = 'pending'
       LIMIT 1`,
      [entityType, entityId, triggerEvent],
    );
    if (existing.length > 0) {
      const name = existing[0].approver_name || 'the designated approver';
      throw new BadRequestException(
        `An approval request is already pending with ${name}`,
      );
    }

    // Insert the request
    const [request] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".approval_requests
         (rule_id, entity_type, entity_id, trigger_event, status, current_step, requested_by)
       VALUES ($1, $2, $3, $4, 'pending', 1, $5)
       RETURNING *`,
      [rule.id, entityType, entityId, triggerEvent, requestedBy],
    );

    // Insert steps from the rule
    for (const step of rule.steps) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".approval_request_steps
           (request_id, step_order, approver_user_id, approver_role_id, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [
          request.id,
          step.stepOrder,
          step.approverType === 'user' ? step.approverUserId : null,
          step.approverType === 'role' ? step.approverRoleId : null,
        ],
      );
    }

    await this.auditService.log(schemaName, {
      entityType: 'approval_requests',
      entityId: request.id,
      action: 'create',
      changes: {},
      newValues: {
        ruleId: rule.id,
        ruleName: rule.name,
        entityType,
        entityId,
        triggerEvent,
      },
      performedBy: requestedBy,
    });

    // Notify step 1 approver
    try {
      await this.notifyApprover(schemaName, request.id, 1);
    } catch (notifyErr) {
      this.logger.error('Failed to send approval notification:', notifyErr);
    }

    return this.getRequest(schemaName, request.id);
  }

  // ============================================================
  // GET SINGLE REQUEST WITH STEPS
  // ============================================================
  async getRequest(schemaName: string, requestId: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT
         r.*,
         req_by.first_name || ' ' || req_by.last_name AS requested_by_name,
         json_agg(
           json_build_object(
             'id', s.id,
             'stepOrder', s.step_order,
             'status', s.status,
             'comment', s.comment,
             'actionedAt', s.actioned_at,
             'approverUserId', s.approver_user_id,
             'approverRoleId', s.approver_role_id,
             'approverName', COALESCE(
               au.first_name || ' ' || au.last_name,
               role.name
             )
           ) ORDER BY s.step_order
         ) AS steps
       FROM "${schemaName}".approval_requests r
       LEFT JOIN "${schemaName}".users req_by ON req_by.id = r.requested_by
       LEFT JOIN "${schemaName}".approval_request_steps s ON s.request_id = r.id
       LEFT JOIN "${schemaName}".users au ON au.id = s.approver_user_id
       LEFT JOIN "${schemaName}".roles role ON role.id = s.approver_role_id
       WHERE r.id = $1
       GROUP BY r.id, req_by.first_name, req_by.last_name`,
      [requestId],
    );

    if (!rows.length) {
      throw new NotFoundException('Approval request not found');
    }

    return this.formatRequest(rows[0]);
  }

  // ============================================================
  // GET LATEST REQUEST FOR AN ENTITY
  // ============================================================
  async getEntityRequest(
    schemaName: string,
    entityType: string,
    entityId: string,
    triggerEvent?: string,
  ): Promise<any | null> {
    const rows = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".approval_requests
       WHERE entity_type = $1 AND entity_id = $2
         AND status IN ('pending', 'approved')
         AND ($3::text IS NULL OR trigger_event = $3)
       ORDER BY created_at DESC
       LIMIT 1`,
      [entityType, entityId, triggerEvent || null],
    );

    if (!rows.length) return null;
    return this.getRequest(schemaName, rows[0].id);
  }

  // ============================================================
  // APPROVE CURRENT STEP
  // ============================================================
  async approve(
    schemaName: string,
    requestId: string,
    userId: string,
    comment?: string,
  ): Promise<any> {
    const request = await this.getRequest(schemaName, requestId);

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    // Find the current pending step
    const [step] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".approval_request_steps
       WHERE request_id = $1 AND step_order = $2 AND status = 'pending'`,
      [requestId, request.currentStep],
    );
    if (!step) {
      throw new BadRequestException(
        'No pending step found for current step order',
      );
    }

    // ── Approver verification ──────────────────────────────────
    await this.verifyApprover(schemaName, step, userId);

    // Mark step approved
    await this.dataSource.query(
      `UPDATE "${schemaName}".approval_request_steps
       SET status = 'approved', comment = $2, actioned_at = NOW()
       WHERE id = $1`,
      [step.id, comment || null],
    );

    // Check if more steps remain
    const [remaining] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM "${schemaName}".approval_request_steps
       WHERE request_id = $1 AND step_order > $2`,
      [requestId, request.currentStep],
    );

    if (remaining.cnt === 0) {
      // Final step — mark entire request approved
      await this.dataSource.query(
        `UPDATE "${schemaName}".approval_requests
         SET status = 'approved', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [requestId],
      );

      // Execute post-approval action on the entity
      await this.executePostApprovalAction(schemaName, request, userId);
    } else {
      // Advance to next step
      await this.dataSource.query(
        `UPDATE "${schemaName}".approval_requests
         SET current_step = current_step + 1, updated_at = NOW()
         WHERE id = $1`,
        [requestId],
      );

      // Notify next approver
      try {
        await this.notifyApprover(
          schemaName,
          requestId,
          request.currentStep + 1,
        );
      } catch (notifyErr) {
        this.logger.error('Failed to send next step notification:', notifyErr);
      }
    }

    await this.auditService.log(schemaName, {
      entityType: 'approval_requests',
      entityId: requestId,
      action: 'update',
      changes: {
        stepStatus: { from: 'pending', to: 'approved' },
        ...(remaining.cnt === 0
          ? { status: { from: 'pending', to: 'approved' } }
          : {
              currentStep: {
                from: request.currentStep,
                to: request.currentStep + 1,
              },
            }),
      },
      newValues: {
        approvedBy: userId,
        stepOrder: request.currentStep,
        comment,
      },
      performedBy: userId,
    });

    return this.getRequest(schemaName, requestId);
  }

  // ============================================================
  // REJECT CURRENT STEP
  // ============================================================
  async reject(
    schemaName: string,
    requestId: string,
    userId: string,
    comment?: string,
  ): Promise<any> {
    const request = await this.getRequest(schemaName, requestId);

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const [step] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".approval_request_steps
       WHERE request_id = $1 AND step_order = $2 AND status = 'pending'`,
      [requestId, request.currentStep],
    );
    if (!step) {
      throw new BadRequestException(
        'No pending step found for current step order',
      );
    }

    // ── Approver verification ──────────────────────────────────
    await this.verifyApprover(schemaName, step, userId);

    // Mark step rejected
    await this.dataSource.query(
      `UPDATE "${schemaName}".approval_request_steps
       SET status = 'rejected', comment = $2, actioned_at = NOW()
       WHERE id = $1`,
      [step.id, comment || null],
    );

    // Mark entire request rejected
    await this.dataSource.query(
      `UPDATE "${schemaName}".approval_requests
       SET status = 'rejected', rejected_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [requestId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'approval_requests',
      entityId: requestId,
      action: 'update',
      changes: { status: { from: 'pending', to: 'rejected' } },
      newValues: {
        rejectedBy: userId,
        stepOrder: request.currentStep,
        comment,
      },
      performedBy: userId,
    });

    return this.getRequest(schemaName, requestId);
  }

  // ============================================================
  // GET PENDING REQUESTS FOR A USER
  // ============================================================
  async getPendingForUser(
    schemaName: string,
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM "${schemaName}".approval_requests r
       JOIN "${schemaName}".approval_request_steps s
         ON s.request_id = r.id AND s.step_order = r.current_step
       LEFT JOIN "${schemaName}".users u ON u.id = $1
       LEFT JOIN "${schemaName}".proposals p_chk
         ON r.entity_type = 'proposals' AND p_chk.id = r.entity_id
       LEFT JOIN "${schemaName}".opportunities o_chk
         ON r.entity_type = 'opportunities' AND o_chk.id = r.entity_id
       LEFT JOIN "${schemaName}".leads l_chk
         ON r.entity_type = 'leads' AND l_chk.id = r.entity_id
       WHERE r.status = 'pending'
         AND (
           s.approver_user_id = $1
           OR s.approver_role_id = u.role_id
         )
         AND NOT (r.entity_type = 'proposals' AND (p_chk.id IS NULL OR p_chk.deleted_at IS NOT NULL))
         AND NOT (r.entity_type = 'opportunities' AND (o_chk.id IS NULL OR o_chk.deleted_at IS NOT NULL))
         AND NOT (r.entity_type = 'leads' AND (l_chk.id IS NULL OR l_chk.deleted_at IS NOT NULL))`,
      [userId],
    );

    const rows = await this.dataSource.query(
      `SELECT
         r.id, r.entity_type, r.entity_id, r.trigger_event,
         r.status, r.current_step, r.created_at,
         req_by.first_name || ' ' || req_by.last_name AS requested_by_name,
         s.id AS step_id, s.step_order, s.approver_user_id, s.approver_role_id,
         -- Entity name resolution
         CASE r.entity_type
           WHEN 'proposals' THEN prop.title
           WHEN 'opportunities' THEN opp_direct.name
           WHEN 'leads' THEN ld.first_name || ' ' || ld.last_name
           ELSE NULL
         END AS entity_name,
         -- Parent entity ID (e.g. opportunity_id for proposals)
         CASE r.entity_type
           WHEN 'proposals' THEN prop.opportunity_id::text
           ELSE NULL
         END AS parent_entity_id
       FROM "${schemaName}".approval_requests r
       JOIN "${schemaName}".approval_request_steps s
         ON s.request_id = r.id AND s.step_order = r.current_step
       LEFT JOIN "${schemaName}".users req_by ON req_by.id = r.requested_by
       LEFT JOIN "${schemaName}".users u ON u.id = $1
       LEFT JOIN "${schemaName}".proposals prop
         ON r.entity_type = 'proposals' AND prop.id = r.entity_id AND prop.deleted_at IS NULL
       LEFT JOIN "${schemaName}".opportunities opp_direct
         ON r.entity_type = 'opportunities' AND opp_direct.id = r.entity_id AND opp_direct.deleted_at IS NULL
       LEFT JOIN "${schemaName}".leads ld
         ON r.entity_type = 'leads' AND ld.id = r.entity_id AND ld.deleted_at IS NULL
       WHERE r.status = 'pending'
         AND (
           s.approver_user_id = $1
           OR s.approver_role_id = u.role_id
         )
         AND NOT (r.entity_type = 'proposals' AND (prop.id IS NULL OR prop.deleted_at IS NOT NULL))
         AND NOT (r.entity_type = 'opportunities' AND (opp_direct.id IS NULL OR opp_direct.deleted_at IS NOT NULL))
         AND NOT (r.entity_type = 'leads' AND (ld.id IS NULL OR ld.deleted_at IS NOT NULL))
       ORDER BY r.created_at ASC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return {
      data: rows.map((r: any) => this.formatPendingRow(r)),
      total: countResult.total,
    };
  }

  // ============================================================
  // CANCEL REQUEST
  // ============================================================
  async cancelRequest(
    schemaName: string,
    requestId: string,
    userId: string,
  ): Promise<void> {
    const request = await this.getRequest(schemaName, requestId);

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    // Only the requester or an admin can cancel
    const [user] = await this.dataSource.query(
      `SELECT u.id, r.level AS role_level
       FROM "${schemaName}".users u
       LEFT JOIN "${schemaName}".roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId],
    );
    const isAdmin = user && user.role_level >= 100;
    const isRequester = request.requestedBy === userId;
    if (!isAdmin && !isRequester) {
      throw new ForbiddenException('Only the requester or an admin can cancel');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".approval_requests
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [requestId],
    );

    await this.dataSource.query(
      `UPDATE "${schemaName}".approval_request_steps
       SET status = 'skipped'
       WHERE request_id = $1 AND status = 'pending'`,
      [requestId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'approval_requests',
      entityId: requestId,
      action: 'update',
      changes: { status: { from: 'pending', to: 'cancelled' } },
      newValues: { cancelledBy: userId },
      performedBy: userId,
    });
  }

  // ============================================================
  // RULE CRUD
  // ============================================================
  async getRules(schemaName: string, entityType?: string): Promise<any[]> {
    const conditions = ['r.deleted_at IS NULL'];
    const params: any[] = [];

    if (entityType) {
      params.push(entityType);
      conditions.push(`r.entity_type = $${params.length}`);
    }

    const rows = await this.dataSource.query(
      `SELECT r.*,
         (SELECT COUNT(*)::int FROM "${schemaName}".approval_rule_steps s WHERE s.rule_id = r.id) AS step_count
       FROM "${schemaName}".approval_rules r
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at DESC`,
      params,
    );

    return rows.map((r: any) => this.formatRule(r));
  }

  async createRule(
    schemaName: string,
    userId: string,
    dto: {
      name: string;
      entityType: string;
      triggerEvent: string;
      conditions?: any;
      steps: Array<{
        stepOrder: number;
        approverType: 'user' | 'role';
        approverUserId?: string;
        approverRoleId?: string;
      }>;
    },
  ): Promise<any> {
    const [rule] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".approval_rules
         (name, entity_type, trigger_event, conditions, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        dto.name,
        dto.entityType,
        dto.triggerEvent,
        dto.conditions || null,
        userId,
      ],
    );

    for (const step of dto.steps) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".approval_rule_steps
           (rule_id, step_order, approver_type, approver_user_id, approver_role_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          rule.id,
          step.stepOrder,
          step.approverType,
          step.approverType === 'user' ? step.approverUserId : null,
          step.approverType === 'role' ? step.approverRoleId : null,
        ],
      );
    }

    await this.auditService.log(schemaName, {
      entityType: 'approval_rules',
      entityId: rule.id,
      action: 'create',
      changes: {},
      newValues: {
        name: dto.name,
        entityType: dto.entityType,
        triggerEvent: dto.triggerEvent,
      },
      performedBy: userId,
    });

    return this.getRuleById(schemaName, rule.id);
  }

  async updateRule(
    schemaName: string,
    ruleId: string,
    userId: string,
    dto: {
      name?: string;
      entityType?: string;
      triggerEvent?: string;
      isActive?: boolean;
      conditions?: any;
      steps?: Array<{
        stepOrder: number;
        approverType: 'user' | 'role';
        approverUserId?: string;
        approverRoleId?: string;
      }>;
    },
  ): Promise<any> {
    await this.getRuleById(schemaName, ruleId);

    // Block update if active pending requests use this rule
    const pending = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".approval_requests
       WHERE rule_id = $1 AND status = 'pending'
       LIMIT 1`,
      [ruleId],
    );
    if (pending.length > 0) {
      throw new BadRequestException(
        'Cannot update rule with active pending requests',
      );
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".approval_rules
       SET name          = COALESCE($2, name),
           entity_type   = COALESCE($3, entity_type),
           trigger_event = COALESCE($4, trigger_event),
           is_active     = COALESCE($5, is_active),
           conditions    = COALESCE($6, conditions),
           updated_at    = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [
        ruleId,
        dto.name || null,
        dto.entityType || null,
        dto.triggerEvent || null,
        dto.isActive !== undefined ? dto.isActive : null,
        dto.conditions !== undefined ? dto.conditions : null,
      ],
    );

    // Replace steps if provided
    if (dto.steps) {
      await this.dataSource.query(
        `DELETE FROM "${schemaName}".approval_rule_steps WHERE rule_id = $1`,
        [ruleId],
      );

      for (const step of dto.steps) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".approval_rule_steps
             (rule_id, step_order, approver_type, approver_user_id, approver_role_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            ruleId,
            step.stepOrder,
            step.approverType,
            step.approverType === 'user' ? step.approverUserId : null,
            step.approverType === 'role' ? step.approverRoleId : null,
          ],
        );
      }
    }

    await this.auditService.log(schemaName, {
      entityType: 'approval_rules',
      entityId: ruleId,
      action: 'update',
      changes: {},
      newValues: dto,
      performedBy: userId,
    });

    return this.getRuleById(schemaName, ruleId);
  }

  async deleteRule(
    schemaName: string,
    ruleId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.getRuleById(schemaName, ruleId);

    await this.dataSource.query(
      `UPDATE "${schemaName}".approval_rules
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [ruleId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'approval_rules',
      entityId: ruleId,
      action: 'delete',
      changes: {},
      newValues: { name: existing.name },
      performedBy: userId,
    });
  }

  async getRuleById(schemaName: string, ruleId: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT
         r.*,
         json_agg(
           json_build_object(
             'id', s.id,
             'stepOrder', s.step_order,
             'approverType', s.approver_type,
             'approverUserId', s.approver_user_id,
             'approverRoleId', s.approver_role_id
           ) ORDER BY s.step_order
         ) AS steps
       FROM "${schemaName}".approval_rules r
       LEFT JOIN "${schemaName}".approval_rule_steps s ON s.rule_id = r.id
       WHERE r.id = $1 AND r.deleted_at IS NULL
       GROUP BY r.id`,
      [ruleId],
    );

    if (!rows.length) {
      throw new NotFoundException('Approval rule not found');
    }

    return this.formatRuleWithSteps(rows[0]);
  }

  // ============================================================
  // PRIVATE: Notify approver for a step
  // ============================================================
  private async notifyApprover(
    schemaName: string,
    requestId: string,
    stepOrder: number,
  ): Promise<void> {
    // 1. Get the request with steps
    const request = await this.getRequest(schemaName, requestId);
    const step = request.steps.find((s: any) => s.stepOrder === stepOrder);
    if (!step) return;

    // 2. Resolve approver email
    let approverEmail: string | null = null;
    let approverName = 'Approver';

    if (step.approverUserId) {
      const [user] = await this.dataSource.query(
        `SELECT email, first_name, last_name
         FROM "${schemaName}".users
         WHERE id = $1`,
        [step.approverUserId],
      );
      if (user) {
        approverEmail = user.email;
        approverName = `${user.first_name} ${user.last_name}`;
      }
    } else if (step.approverRoleId) {
      // Notify all users with this role
      const users = await this.dataSource.query(
        `SELECT email, first_name, last_name
         FROM "${schemaName}".users
         WHERE role_id = $1 AND is_active = true`,
        [step.approverRoleId],
      );
      for (const user of users) {
        await this.sendApprovalEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          request,
          step,
        );
      }
      return;
    }

    if (approverEmail) {
      await this.sendApprovalEmail(approverEmail, approverName, request, step);
    }
  }

  private async sendApprovalEmail(
    to: string,
    approverName: string,
    request: any,
    step: any,
  ): Promise<void> {
    const triggerLabels: Record<string, string> = {
      publish: 'Publish Proposal',
      close_won: 'Close Won',
      discount_threshold: 'Discount Approval',
      manual: 'Manual Approval',
    };

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const queueUrl = `${appUrl}/approvals`;
    const triggerLabel =
      triggerLabels[request.triggerEvent] || request.triggerEvent;

    await this.emailService.sendEmail({
      to,
      subject: `Action Required: ${triggerLabel} approval request`,
      html: `
        <p>Hi ${approverName},</p>
        <p>A new approval request requires your action.</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr>
            <td style="padding:8px;color:#6b7280;font-size:14px">Type</td>
            <td style="padding:8px;font-size:14px">${triggerLabel}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280;font-size:14px">Entity</td>
            <td style="padding:8px;font-size:14px">${request.entityType} &middot; ${request.entityId}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280;font-size:14px">Requested by</td>
            <td style="padding:8px;font-size:14px">${request.requestedByName || 'Unknown'}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280;font-size:14px">Step</td>
            <td style="padding:8px;font-size:14px">${step.stepOrder} of ${request.steps.length}</td>
          </tr>
        </table>
        <br/>
        <a href="${queueUrl}"
           style="display:inline-block;padding:10px 20px;background:#7c3aed;
                  color:white;text-decoration:none;border-radius:8px;font-size:14px">
          Review in Approvals Queue
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">
          You are receiving this because you are the designated approver for this step.
        </p>
      `,
    });
  }

  // ============================================================
  // PRIVATE: Verify approver for a step
  // ============================================================
  private async verifyApprover(
    schemaName: string,
    step: any,
    userId: string,
  ): Promise<void> {
    if (step.approver_user_id) {
      if (step.approver_user_id !== userId) {
        throw new ForbiddenException('You are not the approver for this step');
      }
      return;
    }

    if (step.approver_role_id) {
      const [user] = await this.dataSource.query(
        `SELECT role_id FROM "${schemaName}".users WHERE id = $1`,
        [userId],
      );
      if (!user || user.role_id !== step.approver_role_id) {
        throw new ForbiddenException('You are not the approver for this step');
      }
      return;
    }

    throw new ForbiddenException('You are not the approver for this step');
  }

  // ============================================================
  // PRIVATE: Post-approval entity action
  // ============================================================
  private async executePostApprovalAction(
    schemaName: string,
    request: any,
    approvedBy: string,
  ): Promise<void> {
    try {
      if (
        request.entityType === 'proposals' &&
        request.triggerEvent === 'publish'
      ) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".proposals
           SET status = 'published', published_at = NOW(), published_by = $2, updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [request.entityId, approvedBy],
        );
        this.logger.log(
          `Proposal ${request.entityId} published after approval`,
        );
      }

      if (
        request.entityType === 'opportunities' &&
        request.triggerEvent === 'close_won'
      ) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".opportunities
           SET status = 'closed_won', closed_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [request.entityId],
        );
        this.logger.log(
          `Opportunity ${request.entityId} closed-won after approval`,
        );
      }

      if (
        request.entityType === 'projects' &&
        request.triggerEvent === 'project_completed'
      ) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".projects
           SET actual_end_date = NOW()::DATE, updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [request.entityId],
        );
        this.logger.log(
          `Project ${request.entityId} marked completed after approval`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to execute post-approval action:', err);
    }
  }

  // ============================================================
  // PRIVATE: Format helpers
  // ============================================================
  private formatRequest(r: any): any {
    return {
      id: r.id,
      ruleId: r.rule_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      triggerEvent: r.trigger_event,
      status: r.status,
      currentStep: r.current_step,
      requestedBy: r.requested_by,
      requestedByName: r.requested_by_name,
      completedAt: r.completed_at,
      rejectedAt: r.rejected_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      steps: r.steps && r.steps[0]?.id ? r.steps : [],
    };
  }

  private formatPendingRow(r: any): any {
    return {
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      triggerEvent: r.trigger_event,
      status: r.status,
      currentStep: r.current_step,
      createdAt: r.created_at,
      requestedByName: r.requested_by_name,
      stepId: r.step_id,
      stepOrder: r.step_order,
      approverUserId: r.approver_user_id,
      approverRoleId: r.approver_role_id,
      entityName: r.entity_name || null,
      parentEntityId: r.parent_entity_id || null,
    };
  }

  private formatRule(r: any): any {
    return {
      id: r.id,
      name: r.name,
      entityType: r.entity_type,
      triggerEvent: r.trigger_event,
      isActive: r.is_active,
      conditions: r.conditions,
      stepCount: r.step_count,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private formatRuleWithSteps(r: any): any {
    return {
      id: r.id,
      name: r.name,
      entityType: r.entity_type,
      triggerEvent: r.trigger_event,
      isActive: r.is_active,
      conditions: r.conditions,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      steps: r.steps && r.steps[0]?.id ? r.steps : [],
    };
  }
}
