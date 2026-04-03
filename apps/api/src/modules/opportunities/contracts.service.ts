// ============================================================
// FILE: apps/api/src/modules/opportunities/contracts.service.ts
//
// Full CRUD + signing workflow for contracts.
//
// Follows proposals.service.ts patterns exactly:
//   - Raw SQL with parameterized queries
//   - Audit logging on all mutations
//   - formatContract() / formatContractRow() for consistent camelCase
// ============================================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { EmailService } from '../email/email.service';
import { UploadService } from '../upload/upload.service';
import { DocuSignService } from './docusign.service';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
    private readonly docuSignService: DocuSignService,
  ) {}

  // ============================================================
  // FIND ALL (by opportunity)
  // ============================================================
  async findAll(schemaName: string, opportunityId: string): Promise<any[]> {
    const rows = await this.dataSource.query(
      `SELECT
         c.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         p.title AS proposal_title,
         COUNT(cs.id)::int AS signatory_count,
         COUNT(cs.id) FILTER (WHERE cs.status = 'signed')::int AS signed_count,
         json_agg(
           json_build_object(
             'id', cs.id,
             'signatoryType', cs.signatory_type,
             'signOrder', cs.sign_order,
             'userId', cs.user_id,
             'contactId', cs.contact_id,
             'name', cs.name,
             'email', cs.email,
             'status', cs.status,
             'signedAt', cs.signed_at,
             'token', cs.token,
             'declineReason', cs.decline_reason
           ) ORDER BY cs.sign_order ASC
         ) FILTER (WHERE cs.id IS NOT NULL) AS signatories
       FROM "${schemaName}".contracts c
       LEFT JOIN "${schemaName}".users u ON u.id = c.created_by
       LEFT JOIN "${schemaName}".proposals p ON p.id = c.proposal_id
       LEFT JOIN "${schemaName}".contract_signatories cs ON cs.contract_id = c.id
       WHERE c.opportunity_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id, u.first_name, u.last_name, p.title
       ORDER BY c.created_at DESC`,
      [opportunityId],
    );

    return rows.map((r: any) => ({
      ...this.formatContract(r),
      proposalTitle: r.proposal_title || null,
      createdByName: r.created_by_name || null,
      signatoryCount: parseInt(r.signatory_count, 10) || 0,
      signedCount: parseInt(r.signed_count, 10) || 0,
      signatories: r.signatories || [],
    }));
  }

  // ============================================================
  // FIND ONE
  // ============================================================
  async findOne(schemaName: string, contractId: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT
         c.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         p.title AS proposal_title,
         json_agg(
           json_build_object(
             'id', cs.id,
             'signatoryType', cs.signatory_type,
             'signOrder', cs.sign_order,
             'userId', cs.user_id,
             'contactId', cs.contact_id,
             'name', cs.name,
             'email', cs.email,
             'status', cs.status,
             'signedAt', cs.signed_at,
             'token', cs.token,
             'declineReason', cs.decline_reason
           ) ORDER BY cs.sign_order ASC
         ) FILTER (WHERE cs.id IS NOT NULL) AS signatories
       FROM "${schemaName}".contracts c
       LEFT JOIN "${schemaName}".users u ON u.id = c.created_by
       LEFT JOIN "${schemaName}".proposals p ON p.id = c.proposal_id
       LEFT JOIN "${schemaName}".contract_signatories cs ON cs.contract_id = c.id
       WHERE c.id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id, u.first_name, u.last_name, p.title`,
      [contractId],
    );

    if (!rows.length) throw new NotFoundException('Contract not found');

    const r = rows[0];
    return {
      ...this.formatContract(r),
      proposalTitle: r.proposal_title || null,
      createdByName: r.created_by_name || null,
      signatories: r.signatories || [],
    };
  }

  // ============================================================
  // CREATE FROM PROPOSAL
  // ============================================================
  async createFromProposal(
    schemaName: string,
    opportunityId: string,
    proposalId: string,
    userId: string,
    dto: {
      title?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      renewalDate?: string;
      autoRenewal?: boolean;
      terms?: string;
      signMode?: string;
      signatories?: Array<{
        signatoryType: 'internal' | 'external';
        signOrder: number;
        userId?: string;
        contactId?: string;
        name: string;
        email: string;
      }>;
    },
  ): Promise<any> {
    // 1. Fetch proposal
    const [proposal] = await this.dataSource.query(
      `SELECT id, title, total_amount, currency, terms
       FROM "${schemaName}".proposals
       WHERE id = $1 AND deleted_at IS NULL`,
      [proposalId],
    );
    if (!proposal) throw new NotFoundException('Proposal not found');

    // 2. Generate contract number
    const [seq] = await this.dataSource.query(
      `SELECT 'CNT-' || LPAD(nextval('"${schemaName}".contract_number_seq')::text, 6, '0') AS contract_number`,
    );

    // 3. Insert contract
    const [contract] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".contracts
       (contract_number, opportunity_id, proposal_id, title, type, status,
        sign_mode, value, currency, start_date, end_date, renewal_date,
        auto_renewal, terms, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        seq.contract_number,
        opportunityId,
        proposalId,
        dto.title || proposal.title,
        dto.type || 'service_agreement',
        dto.signMode || 'internal',
        parseFloat(proposal.total_amount) || 0,
        proposal.currency || 'USD',
        dto.startDate || null,
        dto.endDate || null,
        dto.renewalDate || null,
        dto.autoRenewal ?? false,
        dto.terms || proposal.terms || null,
        userId,
      ],
    );

    // 4. Insert signatories
    if (dto.signatories && dto.signatories.length > 0) {
      for (const sig of dto.signatories) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".contract_signatories
           (contract_id, signatory_type, sign_order, user_id, contact_id, name, email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            contract.id,
            sig.signatoryType,
            sig.signOrder,
            sig.userId || null,
            sig.contactId || null,
            sig.name,
            sig.email,
          ],
        );
      }
    }

    // 5. Audit
    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contract.id,
      action: 'create',
      changes: {},
      newValues: {
        contractNumber: seq.contract_number,
        opportunityId,
        proposalId,
        title: dto.title || proposal.title,
      },
      performedBy: userId,
    });

    // 6. Return
    return this.findOne(schemaName, contract.id);
  }

  // ============================================================
  // CREATE (manual — no proposal)
  // ============================================================
  async create(
    schemaName: string,
    opportunityId: string,
    userId: string,
    dto: {
      title: string;
      type?: string;
      value?: number;
      currency?: string;
      startDate?: string;
      endDate?: string;
      renewalDate?: string;
      autoRenewal?: boolean;
      terms?: string;
      signMode?: string;
      documentUrl?: string;
      documentName?: string;
      documentSize?: number;
      signatories?: Array<{
        signatoryType: 'internal' | 'external';
        signOrder: number;
        userId?: string;
        contactId?: string;
        name: string;
        email: string;
      }>;
    },
  ): Promise<any> {
    // 1. Generate contract number
    const [seq] = await this.dataSource.query(
      `SELECT 'CNT-' || LPAD(nextval('"${schemaName}".contract_number_seq')::text, 6, '0') AS contract_number`,
    );

    // 2. Insert contract
    const [contract] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".contracts
       (contract_number, opportunity_id, title, type, status,
        sign_mode, value, currency, start_date, end_date, renewal_date,
        auto_renewal, terms, document_url, document_name, document_size, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        seq.contract_number,
        opportunityId,
        dto.title,
        dto.type || 'service_agreement',
        dto.signMode || 'internal',
        dto.value ?? 0,
        dto.currency || 'USD',
        dto.startDate || null,
        dto.endDate || null,
        dto.renewalDate || null,
        dto.autoRenewal ?? false,
        dto.terms || null,
        dto.documentUrl || null,
        dto.documentName || null,
        dto.documentSize || null,
        userId,
      ],
    );

    // 3. Insert signatories
    if (dto.signatories && dto.signatories.length > 0) {
      for (const sig of dto.signatories) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".contract_signatories
           (contract_id, signatory_type, sign_order, user_id, contact_id, name, email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            contract.id,
            sig.signatoryType,
            sig.signOrder,
            sig.userId || null,
            sig.contactId || null,
            sig.name,
            sig.email,
          ],
        );
      }
    }

    // 4. Audit
    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contract.id,
      action: 'create',
      changes: {},
      newValues: {
        contractNumber: seq.contract_number,
        opportunityId,
        title: dto.title,
      },
      performedBy: userId,
    });

    // 5. Return
    return this.findOne(schemaName, contract.id);
  }

  // ============================================================
  // UPDATE (draft only)
  // ============================================================
  async update(
    schemaName: string,
    contractId: string,
    userId: string,
    dto: Partial<{
      title: string;
      type: string;
      value: number;
      currency: string;
      startDate: string;
      endDate: string;
      renewalDate: string;
      autoRenewal: boolean;
      terms: string;
      signMode: string;
    }>,
  ): Promise<any> {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [contractId],
    );
    if (!existing) throw new NotFoundException('Contract not found');
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft contracts can be edited');
    }

    const fieldMap: Record<string, string> = {
      title: 'title',
      type: 'type',
      value: 'value',
      currency: 'currency',
      startDate: 'start_date',
      endDate: 'end_date',
      renewalDate: 'renewal_date',
      autoRenewal: 'auto_renewal',
      terms: 'terms',
      signMode: 'sign_mode',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [dtoKey, dbCol] of Object.entries(fieldMap)) {
      if ((dto as any)[dtoKey] !== undefined) {
        updates.push(`${dbCol} = $${idx}`);
        params.push((dto as any)[dtoKey]);
        idx++;
      }
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(contractId);
      await this.dataSource.query(
        `UPDATE "${schemaName}".contracts SET ${updates.join(', ')} WHERE id = $${idx}`,
        params,
      );
    }

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contractId,
      action: 'update',
      changes: {},
      newValues: dto as unknown as Record<string, unknown>,
      performedBy: userId,
    });

    return this.findOne(schemaName, contractId);
  }

  // ============================================================
  // SEND FOR SIGNING
  // ============================================================
  async sendForSigning(
    schemaName: string,
    contractId: string,
    userId: string,
  ): Promise<any> {
    const contract = await this.findOne(schemaName, contractId);

    if (contract.status !== 'draft') {
      throw new BadRequestException(
        'Only draft contracts can be sent for signing',
      );
    }

    // Must have at least 1 signatory
    const [sigCount] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM "${schemaName}".contract_signatories WHERE contract_id = $1`,
      [contractId],
    );
    if (parseInt(sigCount.cnt, 10) === 0) {
      throw new BadRequestException(
        'Contract must have at least one signatory before sending',
      );
    }

    // Check if DocuSign is enabled for this tenant
    const docusignRows = await this.dataSource.query(
      `SELECT * FROM public.tenant_integrations
       WHERE tenant_id = (
         SELECT id FROM master.tenants WHERE schema_name = $1
       ) AND provider = 'docusign' AND is_enabled = true`,
      [schemaName],
    );
    const docusignEnabled = docusignRows.length > 0;

    const signMode = docusignEnabled ? 'docusign' : 'internal';

    // Update contract status
    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts
       SET status = 'sent_for_signing', sign_mode = $2, updated_at = NOW()
       WHERE id = $1`,
      [contractId, signMode],
    );

    if (docusignEnabled) {
      // Send via DocuSign
      try {
        const tenantId = docusignRows[0].tenant_id;
        await this.docuSignService.sendEnvelopeForContract(
          schemaName,
          contractId,
          tenantId,
        );
        this.logger.log(`Contract ${contractId} sent via DocuSign`);
      } catch (err: any) {
        this.logger.error(`DocuSign send failed for contract ${contractId}`, err?.message);
        throw new BadRequestException(
          err?.message || 'Failed to send contract via DocuSign. Check integration settings.',
        );
      }
    } else {
      // Internal signing flow
      // Mark first signatory as sent
      await this.dataSource.query(
        `UPDATE "${schemaName}".contract_signatories
         SET status = 'sent'
         WHERE contract_id = $1 AND sign_order = 1`,
        [contractId],
      );

      // Send signing emails to all signatories
      await this.sendSigningEmails(schemaName, contractId, contract);
    }

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contractId,
      action: 'update',
      changes: { status: { from: 'draft', to: 'sent_for_signing' } },
      newValues: { status: 'sent_for_signing', signMode },
      performedBy: userId,
    });

    return this.findOne(schemaName, contractId);
  }

  // ============================================================
  // SIGN (internal e-sign — by token)
  // ============================================================
  async sign(
    schemaName: string,
    contractId: string,
    token: string,
    signatureData: string,
    ipAddress: string,
  ): Promise<any> {
    // Find signatory by token
    const [signatory] = await this.dataSource.query(
      `SELECT cs.*, c.status AS contract_status, c.id AS cid
       FROM "${schemaName}".contract_signatories cs
       JOIN "${schemaName}".contracts c ON c.id = cs.contract_id
       WHERE cs.token = $1`,
      [token],
    );
    if (!signatory) throw new NotFoundException('Signatory not found');

    if (signatory.status === 'signed') {
      throw new BadRequestException('This signatory has already signed');
    }

    if (
      !['sent_for_signing', 'partially_signed'].includes(
        signatory.contract_status,
      )
    ) {
      throw new BadRequestException('Contract is not in a signable state');
    }

    // Mark signatory as signed
    await this.dataSource.query(
      `UPDATE "${schemaName}".contract_signatories
       SET status = 'signed', signed_at = NOW(), signature_data = $2, ip_address = $3
       WHERE token = $1`,
      [token, signatureData, ipAddress],
    );

    // Check if all signatories signed
    const [unsignedResult] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE status != 'signed')::int AS unsigned_count
       FROM "${schemaName}".contract_signatories
       WHERE contract_id = $1`,
      [signatory.contract_id],
    );

    if (parseInt(unsignedResult.unsigned_count, 10) === 0) {
      // All signed — mark fully signed
      await this.dataSource.query(
        `UPDATE "${schemaName}".contracts SET status = 'fully_signed', updated_at = NOW() WHERE id = $1`,
        [signatory.contract_id],
      );
    } else {
      // Partially signed — advance to next signatory
      await this.dataSource.query(
        `UPDATE "${schemaName}".contracts SET status = 'partially_signed', updated_at = NOW() WHERE id = $1`,
        [signatory.contract_id],
      );

      // Send next signatory in order
      const nextSignatories = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".contract_signatories
         WHERE contract_id = $1 AND status = 'pending'
         ORDER BY sign_order ASC
         LIMIT 1`,
        [signatory.contract_id],
      );
      if (nextSignatories.length > 0) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".contract_signatories SET status = 'sent' WHERE id = $1`,
          [nextSignatories[0].id],
        );
      }
    }

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: signatory.contract_id,
      action: 'update',
      changes: { signatoryStatus: { from: signatory.status, to: 'signed' } },
      newValues: {
        signedBy: signatory.name,
        signedByEmail: signatory.email,
        ipAddress,
      },
      performedBy: signatory.user_id || signatory.name,
    });

    return this.findOne(schemaName, signatory.contract_id);
  }

  // ============================================================
  // DECLINE (signatory declines — by token)
  // ============================================================
  async decline(
    schemaName: string,
    token: string,
    reason?: string,
  ): Promise<any> {
    const [signatory] = await this.dataSource.query(
      `SELECT cs.*, c.id AS cid
       FROM "${schemaName}".contract_signatories cs
       JOIN "${schemaName}".contracts c ON c.id = cs.contract_id
       WHERE cs.token = $1`,
      [token],
    );
    if (!signatory) throw new NotFoundException('Signatory not found');

    // Mark signatory as declined with reason
    await this.dataSource.query(
      `UPDATE "${schemaName}".contract_signatories SET status = 'declined', decline_reason = $2 WHERE token = $1`,
      [token, reason || null],
    );

    // Terminate the contract
    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts SET status = 'terminated', updated_at = NOW() WHERE id = $1`,
      [signatory.contract_id],
    );

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: signatory.contract_id,
      action: 'update',
      changes: { status: { from: 'sent_for_signing', to: 'terminated' } },
      newValues: { declinedBy: signatory.name, reason: reason || null },
      performedBy: signatory.user_id || signatory.name,
    });

    return this.findOne(schemaName, signatory.contract_id);
  }

  // ============================================================
  // ADD SIGNATORY (draft only)
  // ============================================================
  async addSignatory(
    schemaName: string,
    contractId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userId: string,
    dto: {
      signatoryType: 'internal' | 'external';
      signOrder: number;
      userId?: string;
      contactId?: string;
      name: string;
      email: string;
    },
  ): Promise<any> {
    const [contract] = await this.dataSource.query(
      `SELECT status FROM "${schemaName}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [contractId],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'draft') {
      throw new BadRequestException(
        'Signatories can only be added to draft contracts',
      );
    }

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".contract_signatories
       (contract_id, signatory_type, sign_order, user_id, contact_id, name, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        contractId,
        dto.signatoryType,
        dto.signOrder,
        dto.userId || null,
        dto.contactId || null,
        dto.name,
        dto.email,
      ],
    );

    return this.findOne(schemaName, contractId);
  }

  // ============================================================
  // REMOVE SIGNATORY (draft only)
  // ============================================================
  async removeSignatory(
    schemaName: string,
    contractId: string,
    signatoryId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userId: string,
  ): Promise<any> {
    const [contract] = await this.dataSource.query(
      `SELECT status FROM "${schemaName}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [contractId],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'draft') {
      throw new BadRequestException(
        'Signatories can only be removed from draft contracts',
      );
    }

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".contract_signatories WHERE id = $1 AND contract_id = $2`,
      [signatoryId, contractId],
    );

    return this.findOne(schemaName, contractId);
  }

  // ============================================================
  // TERMINATE
  // ============================================================
  async terminate(
    schemaName: string,
    contractId: string,
    userId: string,
    reason?: string,
  ): Promise<any> {
    const [contract] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [contractId],
    );
    if (!contract) throw new NotFoundException('Contract not found');

    if (
      !['sent_for_signing', 'partially_signed', 'fully_signed'].includes(
        contract.status,
      )
    ) {
      throw new BadRequestException('Only active contracts can be terminated');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts SET status = 'terminated', updated_at = NOW() WHERE id = $1`,
      [contractId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contractId,
      action: 'update',
      changes: { status: { from: contract.status, to: 'terminated' } },
      newValues: { reason: reason || null },
      performedBy: userId,
    });

    return this.findOne(schemaName, contractId);
  }

  // ============================================================
  // GET BY TOKEN (public — for signatory to view)
  // ============================================================
  async getByToken(schemaName: string, token: string): Promise<any> {
    // Find signatory by token to get contract_id
    const [signatory] = await this.dataSource.query(
      `SELECT contract_id FROM "${schemaName}".contract_signatories WHERE token = $1`,
      [token],
    );
    if (!signatory) throw new NotFoundException('Contract not found');

    // Get contract with signatories — but strip signature_data from others
    const rows = await this.dataSource.query(
      `SELECT
         c.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         p.title AS proposal_title,
         json_agg(
           json_build_object(
             'id', cs.id,
             'signatoryType', cs.signatory_type,
             'signOrder', cs.sign_order,
             'name', cs.name,
             'email', cs.email,
             'status', cs.status,
             'signedAt', cs.signed_at,
             'isCurrentUser', (cs.token = $2),
             'declineReason', cs.decline_reason
           ) ORDER BY cs.sign_order ASC
         ) FILTER (WHERE cs.id IS NOT NULL) AS signatories
       FROM "${schemaName}".contracts c
       LEFT JOIN "${schemaName}".users u ON u.id = c.created_by
       LEFT JOIN "${schemaName}".proposals p ON p.id = c.proposal_id
       LEFT JOIN "${schemaName}".contract_signatories cs ON cs.contract_id = c.id
       WHERE c.id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id, u.first_name, u.last_name, p.title`,
      [signatory.contract_id, token],
    );

    if (!rows.length) throw new NotFoundException('Contract not found');

    const r = rows[0];
    return {
      ...this.formatContract(r),
      proposalTitle: r.proposal_title || null,
      signatories: r.signatories || [],
    };
  }

  // ============================================================
  // FIND SCHEMA BY CONTRACT TOKEN (for public endpoints)
  // ============================================================
  async findSchemaByContractToken(
    token: string,
  ): Promise<{ schemaName: string }> {
    const tenants = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
    );

    for (const tenant of tenants) {
      try {
        const [row] = await this.dataSource.query(
          `SELECT id FROM "${tenant.schema_name}".contract_signatories
           WHERE token = $1 LIMIT 1`,
          [token],
        );
        if (row) return { schemaName: tenant.schema_name };
      } catch {
        // Skip broken schemas
      }
    }

    throw new NotFoundException('Contract not found');
  }

  // ============================================================
  // FIND SCHEMA BY ENVELOPE ID (for DocuSign webhook)
  // ============================================================
  async findSchemaByEnvelopeId(
    envelopeId: string,
  ): Promise<{ schemaName: string } | null> {
    const tenants = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
    );

    for (const tenant of tenants) {
      try {
        const [row] = await this.dataSource.query(
          `SELECT id FROM "${tenant.schema_name}".contracts
           WHERE docusign_envelope_id = $1 AND deleted_at IS NULL LIMIT 1`,
          [envelopeId],
        );
        if (row) return { schemaName: tenant.schema_name };
      } catch {
        // Skip broken schemas
      }
    }

    return null;
  }

  // ============================================================
  // DELETE (soft — draft only)
  // ============================================================
  async delete(
    schemaName: string,
    contractId: string,
    userId: string,
  ): Promise<any> {
    const [contract] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [contractId],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'draft') {
      throw new BadRequestException('Only draft contracts can be deleted');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [contractId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contractId,
      action: 'delete',
      changes: {},
      previousValues: this.formatContract(contract),
      performedBy: userId,
    });

    return { message: 'Contract deleted' };
  }

  // ============================================================
  // UPLOAD DOCUMENT (draft only)
  // ============================================================
  async uploadDocument(
    schemaName: string,
    contractId: string,
    userId: string,
    file: Express.Multer.File,
    tenantSlug: string,
  ): Promise<any> {
    const [contract] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [contractId],
    );
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'draft') {
      throw new BadRequestException('Documents can only be uploaded to draft contracts');
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are allowed');
    }

    // Upload to S3/storage
    const uploadResult = await this.uploadService.uploadFile(
      file,
      'contracts',
      tenantSlug,
    );

    // Update contract with document info
    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts
       SET document_url = $1, document_name = $2, document_size = $3, updated_at = NOW()
       WHERE id = $4`,
      [uploadResult.url, file.originalname, file.size, contractId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contractId,
      action: 'update',
      changes: {
        documentUrl: { from: contract.document_url || null, to: uploadResult.url },
      },
      newValues: {
        documentUrl: uploadResult.url,
        documentName: file.originalname,
        documentSize: file.size,
      },
      performedBy: userId,
    });

    return this.findOne(schemaName, contractId);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  // ============================================================
  // RESEND SIGNING EMAILS (for sent_for_signing / partially_signed)
  // ============================================================
  async resendEmails(
    schemaName: string,
    contractId: string,
    userId: string,
  ): Promise<any> {
    const contract = await this.findOne(schemaName, contractId);

    if (!['sent_for_signing', 'partially_signed'].includes(contract.status)) {
      throw new BadRequestException(
        'Emails can only be resent for contracts that are currently out for signing',
      );
    }

    await this.sendSigningEmails(schemaName, contractId, contract);

    await this.auditService.log(schemaName, {
      entityType: 'contracts',
      entityId: contractId,
      action: 'update',
      changes: {},
      newValues: { action: 'resend_emails' },
      performedBy: userId,
    });

    return { message: 'Signing emails resent successfully' };
  }

  // ============================================================
  // SEND SIGNING EMAILS (private helper)
  // ============================================================
  private async sendSigningEmails(
    schemaName: string,
    contractId: string,
    contract: any,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ||
      'http://localhost:5173';

    // Query signatories who haven't signed yet
    const signatories = await this.dataSource.query(
      `SELECT id, name, email, token, status, sign_order
       FROM "${schemaName}".contract_signatories
       WHERE contract_id = $1 AND status != 'signed'
       ORDER BY sign_order ASC`,
      [contractId],
    );

    for (const sig of signatories) {
      if (!sig.email || !sig.token) continue;

      const signUrl = `${frontendUrl}/contracts/sign/${sig.token}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px;text-align:center;">
                  <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Contract Signing Request</h1>
                </td></tr>
                <tr><td style="padding:40px;">
                  <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:20px;">Hello ${sig.name},</h2>
                  <p style="color:#4a4a68;line-height:1.6;margin:0 0 24px;">
                    You have been requested to sign the following contract:
                  </p>
                  <div style="background:#f8f9fb;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0 0 8px;color:#4a4a68;"><strong>Contract:</strong> ${contract.title}</p>
                    <p style="margin:0 0 8px;color:#4a4a68;"><strong>Number:</strong> ${contract.contractNumber}</p>
                    <p style="margin:0;color:#4a4a68;"><strong>Value:</strong> ${contract.currency} ${contract.value?.toLocaleString?.() || contract.value}</p>
                  </div>
                  <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);border-radius:8px;padding:14px 32px;">
                      <a href="${signUrl}" style="color:#fff;text-decoration:none;font-weight:600;font-size:16px;">Review & Sign</a>
                    </td></tr>
                  </table>
                  <p style="color:#8a8aab;font-size:13px;line-height:1.5;margin:0;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${signUrl}" style="color:#2563eb;word-break:break-all;">${signUrl}</a>
                  </p>
                </td></tr>
                <tr><td style="background:#f8f9fb;padding:20px 40px;text-align:center;">
                  <p style="color:#8a8aab;font-size:12px;margin:0;">
                    &copy; ${new Date().getFullYear()} Intellicon CRM. All rights reserved.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `;

      try {
        await this.emailService.sendEmail({
          to: sig.email,
          subject: `Contract Signing Request: ${contract.title} (${contract.contractNumber})`,
          html,
        });
        this.logger.log(
          `Signing email sent to ${sig.name} <${sig.email}> for contract ${contractId}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to send signing email to ${sig.email} for contract ${contractId}`,
          err,
        );
      }
    }
  }

  private formatContract(r: any) {
    return {
      id: r.id,
      contractNumber: r.contract_number,
      opportunityId: r.opportunity_id,
      proposalId: r.proposal_id,
      title: r.title,
      type: r.type,
      status: r.status,
      signMode: r.sign_mode,
      value: parseFloat(r.value) || 0,
      currency: r.currency,
      startDate: r.start_date,
      endDate: r.end_date,
      renewalDate: r.renewal_date,
      autoRenewal: r.auto_renewal,
      terms: r.terms,
      documentUrl: r.document_url || null,
      documentName: r.document_name || null,
      documentSize: r.document_size ? parseInt(r.document_size, 10) : null,
      docusignEnvelopeId: r.docusign_envelope_id,
      docusignStatus: r.docusign_status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
