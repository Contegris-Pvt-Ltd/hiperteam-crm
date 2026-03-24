// ============================================================
// FILE: apps/api/src/modules/opportunities/proposals.service.ts
//
// Full CRUD + send + accept/decline + view tracking for proposals.
//
// Follows opportunities.service.ts patterns exactly:
//   - Raw SQL with parameterized queries
//   - Audit + Activity logging on all mutations
//   - formatProposal() / formatLineItem() for consistent camelCase
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { EmailService } from '../email/email.service';
import { ApprovalService } from '../shared/approval.service';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly activityService: ActivityService,
    private readonly emailService: EmailService,
    private readonly approvalService: ApprovalService,
  ) {}

  // ============================================================
  // FIND ALL (by opportunity)
  // ============================================================
  async findAll(schemaName: string, opportunityId: string) {
    const rows = await this.dataSource.query(
      `SELECT p.*,
              u.first_name as created_by_first_name, u.last_name as created_by_last_name,
              (SELECT COUNT(*) FROM "${schemaName}".proposal_line_items li
               WHERE li.proposal_id = p.id) as line_item_count
       FROM "${schemaName}".proposals p
       LEFT JOIN "${schemaName}".users u ON u.id = p.created_by
       WHERE p.opportunity_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [opportunityId],
    );

    return rows.map((r: any) => ({
      ...this.formatProposal(r),
      lineItemCount: parseInt(r.line_item_count, 10) || 0,
    }));
  }

  // ============================================================
  // FIND ONE
  // ============================================================
  async findOne(schemaName: string, proposalId: string) {
    const [row] = await this.dataSource.query(
      `SELECT p.*,
              u.first_name as created_by_first_name, u.last_name as created_by_last_name
       FROM "${schemaName}".proposals p
       LEFT JOIN "${schemaName}".users u ON u.id = p.created_by
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [proposalId],
    );

    if (!row) throw new NotFoundException('Proposal not found');

    const lineItems = await this.dataSource.query(
      `SELECT li.*,
              pr.name as product_name, pr.code as product_code
       FROM "${schemaName}".proposal_line_items li
       LEFT JOIN "${schemaName}".products pr ON pr.id = li.product_id
       WHERE li.proposal_id = $1
       ORDER BY li.sort_order ASC`,
      [proposalId],
    );

    return {
      ...this.formatProposal(row),
      lineItems: lineItems.map((i: any) => this.formatLineItem(i)),
    };
  }

  // ============================================================
  // FIND BY TOKEN (public — no userId needed)
  // ============================================================
  async findByToken(schemaName: string, token: string) {
    const [row] = await this.dataSource.query(
      `SELECT p.*,
              u.first_name as created_by_first_name, u.last_name as created_by_last_name
       FROM "${schemaName}".proposals p
       LEFT JOIN "${schemaName}".users u ON u.id = p.created_by
       WHERE p.public_token = $1
         AND p.deleted_at IS NULL
         AND p.status != 'draft'`,
      [token],
    );

    if (!row) throw new NotFoundException('Proposal not found');

    const lineItems = await this.dataSource.query(
      `SELECT li.*,
              pr.name as product_name, pr.code as product_code
       FROM "${schemaName}".proposal_line_items li
       LEFT JOIN "${schemaName}".products pr ON pr.id = li.product_id
       WHERE li.proposal_id = $1
       ORDER BY li.sort_order ASC`,
      [row.id],
    );

    return {
      ...this.formatProposal(row),
      lineItems: lineItems.map((i: any) => this.formatLineItem(i)),
    };
  }

  // ============================================================
  // CREATE
  // ============================================================
  async create(
    schemaName: string,
    tenantId: string,
    opportunityId: string,
    userId: string,
    dto: {
      title: string;
      coverMessage?: string;
      terms?: string;
      validUntil?: string;
      currency?: string;
      lineItems?: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        discountType?: 'percentage' | 'fixed';
      }[];
    },
  ) {
    // 1. Verify opportunity exists
    const [opp] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".opportunities WHERE id = $1 AND deleted_at IS NULL`,
      [opportunityId],
    );
    if (!opp) throw new NotFoundException('Opportunity not found');

    // 2. Insert proposal
    const [proposal] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".proposals
       (opportunity_id, title, cover_message, terms, valid_until, currency, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        opportunityId,
        dto.title,
        dto.coverMessage || null,
        dto.terms || null,
        dto.validUntil || null,
        dto.currency || 'USD',
        userId,
        tenantId,
      ],
    );

    // 3. Insert line items
    let totalAmount = 0;
    if (dto.lineItems && dto.lineItems.length > 0) {
      for (let i = 0; i < dto.lineItems.length; i++) {
        const item = dto.lineItems[i];
        const discount = item.discount || 0;
        const discountType = item.discountType || 'percentage';
        const lineTotal = this.calculateLineTotal(item.quantity, item.unitPrice, discount, discountType);
        totalAmount += lineTotal;

        await this.dataSource.query(
          `INSERT INTO "${schemaName}".proposal_line_items
           (proposal_id, product_id, description, quantity, unit_price, discount, discount_type, total, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            proposal.id,
            item.productId || null,
            item.description,
            item.quantity,
            item.unitPrice,
            discount,
            discountType,
            lineTotal,
            i,
          ],
        );
      }
    }

    // 4. Update total_amount
    await this.dataSource.query(
      `UPDATE "${schemaName}".proposals SET total_amount = $1 WHERE id = $2`,
      [totalAmount, proposal.id],
    );

    // 5. Audit + Activity
    await this.auditService.log(schemaName, {
      entityType: 'proposals',
      entityId: proposal.id,
      action: 'create',
      changes: {},
      newValues: { title: dto.title, opportunityId, totalAmount },
      performedBy: userId,
    });

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opportunityId,
      activityType: 'proposal_created',
      title: 'Proposal created',
      description: `Proposal "${dto.title}" was created`,
      metadata: { proposalId: proposal.id, title: dto.title, totalAmount },
      performedBy: userId,
    });

    return this.findOne(schemaName, proposal.id);
  }

  // ============================================================
  // UPDATE (draft only)
  // ============================================================
  async update(
    schemaName: string,
    proposalId: string,
    userId: string,
    dto: {
      title?: string;
      coverMessage?: string;
      terms?: string;
      validUntil?: string;
      currency?: string;
      lineItems?: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        discountType?: 'percentage' | 'fixed';
      }[];
    },
  ) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".proposals WHERE id = $1 AND deleted_at IS NULL`,
      [proposalId],
    );
    if (!existing) throw new NotFoundException('Proposal not found');
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft proposals can be edited');
    }

    // 1. Update proposal fields
    const fieldMap: Record<string, string> = {
      title: 'title',
      coverMessage: 'cover_message',
      terms: 'terms',
      validUntil: 'valid_until',
      currency: 'currency',
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
      params.push(proposalId);
      await this.dataSource.query(
        `UPDATE "${schemaName}".proposals SET ${updates.join(', ')} WHERE id = $${idx}`,
        params,
      );
    }

    // 2. Replace line items if provided
    if (dto.lineItems !== undefined) {
      await this.dataSource.query(
        `DELETE FROM "${schemaName}".proposal_line_items WHERE proposal_id = $1`,
        [proposalId],
      );

      let totalAmount = 0;
      for (let i = 0; i < dto.lineItems.length; i++) {
        const item = dto.lineItems[i];
        const discount = item.discount || 0;
        const discountType = item.discountType || 'percentage';
        const lineTotal = this.calculateLineTotal(item.quantity, item.unitPrice, discount, discountType);
        totalAmount += lineTotal;

        await this.dataSource.query(
          `INSERT INTO "${schemaName}".proposal_line_items
           (proposal_id, product_id, description, quantity, unit_price, discount, discount_type, total, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            proposalId,
            item.productId || null,
            item.description,
            item.quantity,
            item.unitPrice,
            discount,
            discountType,
            lineTotal,
            i,
          ],
        );
      }

      await this.dataSource.query(
        `UPDATE "${schemaName}".proposals SET total_amount = $1, updated_at = NOW() WHERE id = $2`,
        [totalAmount, proposalId],
      );

      // ── Discount threshold check ──────────────────────────────
      const maxDiscount = await this.getMaxDiscountPercent(schemaName, proposalId);
      if (maxDiscount > 0) {
        const rule = await this.approvalService.findActiveRule(
          schemaName,
          'proposals',
          'discount_threshold',
        );
        if (rule && rule.conditions?.maxDiscountPercent) {
          const threshold = parseFloat(rule.conditions.maxDiscountPercent);
          if (maxDiscount > threshold) {
            await this.approvalService.cancelStaleRequest(
              schemaName,
              'proposals',
              proposalId,
              'discount_threshold',
            );
            try {
              await this.approvalService.createRequest(
                schemaName,
                'proposals',
                proposalId,
                'discount_threshold',
                userId,
              );
            } catch {
              // Already pending — that's fine
            }
          }
        }
      }
    }

    // 3. Audit
    await this.auditService.log(schemaName, {
      entityType: 'proposals',
      entityId: proposalId,
      action: 'update',
      changes: {},
      newValues: dto as unknown as Record<string, unknown>,
      performedBy: userId,
    });

    return this.findOne(schemaName, proposalId);
  }

  // ============================================================
  // SEND
  // ============================================================
  async send(schemaName: string, proposalId: string, userId: string) {
    const [proposal] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".proposals WHERE id = $1 AND deleted_at IS NULL`,
      [proposalId],
    );
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'published') {
      throw new BadRequestException('Only published proposals can be sent');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".proposals SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [proposalId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'proposals',
      entityId: proposalId,
      action: 'update',
      changes: { status: { from: 'published', to: 'sent' } },
      newValues: { status: 'sent' },
      performedBy: userId,
    });

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: proposal.opportunity_id,
      activityType: 'proposal_sent',
      title: 'Proposal sent',
      description: `Proposal "${proposal.title}" was sent`,
      metadata: { proposalId, title: proposal.title },
      performedBy: userId,
    });

    return this.findOne(schemaName, proposalId);
  }

  // ============================================================
  // PUBLISH (locks the proposal for sending)
  // ============================================================
  async publish(schemaName: string, proposalId: string, userId: string) {
    const [proposal] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".proposals WHERE id = $1 AND deleted_at IS NULL`,
      [proposalId],
    );
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'draft') {
      throw new BadRequestException('Only draft proposals can be published');
    }

    // RBAC: opportunity owner, team lead, manager, or admin
    const [access] = await this.dataSource.query(
      `SELECT
         o.owner_id,
         t.team_lead_id       AS team_lead_id,
         u.manager_id         AS manager_id,
         r.level              AS role_level
       FROM "${schemaName}".proposals p
       JOIN "${schemaName}".opportunities o ON o.id = p.opportunity_id
       LEFT JOIN "${schemaName}".teams t    ON t.id = o.team_id
       JOIN "${schemaName}".users u         ON u.id = $2
       LEFT JOIN "${schemaName}".roles r    ON r.id = u.role_id
       WHERE p.id = $1`,
      [proposalId, userId],
    );
    if (!access) throw new NotFoundException('Proposal not found');
    const isAdmin      = access.role_level >= 100;
    const isOwner      = access.owner_id === userId;
    const isTeamLead   = access.team_lead_id === userId;
    const isManager    = access.manager_id === userId;
    if (!isAdmin && !isOwner && !isTeamLead && !isManager) {
      throw new ForbiddenException(
        'Only the opportunity owner, team lead, manager, or admin can publish proposals',
      );
    }

    // Block publish if a discount approval is still pending
    const pendingDiscount = await this.approvalService.getEntityRequest(
      schemaName,
      'proposals',
      proposalId,
      'discount_threshold',
    );
    if (pendingDiscount && pendingDiscount.status === 'pending') {
      throw new BadRequestException(
        'This proposal has a discount that requires approval before it can be published.',
      );
    }

    // Approval gate — if a rule exists, block and return the request
    const approvalRequest = await this.approvalService.createRequest(
      schemaName, 'proposals', proposalId, 'publish', userId,
    );
    if (approvalRequest !== null) {
      return {
        approvalRequired: true,
        approvalRequest,
        message: 'Proposal submitted for approval before publishing',
      };
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".proposals
       SET status = 'published', published_at = NOW(), published_by = $2, updated_at = NOW()
       WHERE id = $1`,
      [proposalId, userId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'proposals',
      entityId: proposalId,
      action: 'update',
      changes: { status: { from: 'draft', to: 'published' } },
      newValues: { status: 'published' },
      performedBy: userId,
    });

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: proposal.opportunity_id,
      activityType: 'proposal_published',
      title: 'Proposal published',
      description: `Proposal "${proposal.title}" was published`,
      metadata: { proposalId, title: proposal.title },
      performedBy: userId,
    });

    return this.findOne(schemaName, proposalId);
  }

  // ============================================================
  // ACCEPT (public — by token)
  // ============================================================
  async accept(schemaName: string, token: string) {
    const [proposal] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".proposals
       WHERE public_token = $1 AND deleted_at IS NULL AND status IN ('published', 'sent', 'viewed')`,
      [token],
    );
    if (!proposal) {
      throw new BadRequestException('Proposal not found or cannot be accepted');
    }

    if (proposal.valid_until && new Date(proposal.valid_until) < new Date()) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".proposals SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [proposal.id],
      );
      throw new BadRequestException('This proposal has expired');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".proposals SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [proposal.id],
    );

    return { message: 'Proposal accepted' };
  }

  // ============================================================
  // DECLINE (public — by token)
  // ============================================================
  async decline(schemaName: string, token: string) {
    const [proposal] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".proposals
       WHERE public_token = $1 AND deleted_at IS NULL AND status IN ('published', 'sent', 'viewed')`,
      [token],
    );
    if (!proposal) {
      throw new BadRequestException('Proposal not found or cannot be declined');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".proposals SET status = 'declined', declined_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [proposal.id],
    );

    return { message: 'Proposal declined' };
  }

  // ============================================================
  // TRACK VIEW (public — by token)
  // ============================================================
  async trackView(schemaName: string, token: string, ipAddress: string | null, userAgent: string | null) {
    const [proposal] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".proposals WHERE public_token = $1 AND deleted_at IS NULL`,
      [token],
    );
    if (!proposal) throw new NotFoundException('Proposal not found');

    // Record the view
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".proposal_views (proposal_id, ip_address, user_agent)
       VALUES ($1, $2, $3)`,
      [proposal.id, ipAddress, userAgent],
    );

    // Update status to 'viewed' if this is the first view and proposal is 'sent'
    if (!proposal.viewed_at && proposal.status === 'sent') {
      await this.dataSource.query(
        `UPDATE "${schemaName}".proposals SET status = 'viewed', viewed_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'sent'`,
        [proposal.id],
      );
    }

    return proposal;
  }

  // ============================================================
  // DELETE (soft — draft only)
  // ============================================================
  async delete(schemaName: string, proposalId: string, userId: string) {
    const [proposal] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".proposals WHERE id = $1 AND deleted_at IS NULL`,
      [proposalId],
    );
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'draft') {
      throw new BadRequestException('Only draft proposals can be deleted');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".proposals SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [proposalId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'proposals',
      entityId: proposalId,
      action: 'delete',
      changes: {},
      previousValues: this.formatProposal(proposal),
      performedBy: userId,
    });

    return { message: 'Proposal deleted' };
  }

  // ============================================================
  // GENERATE PDF
  // ============================================================
  private async getCompanyInfo(schemaName: string) {
    const [row] = await this.dataSource.query(
      `SELECT company_name, tagline, email, phone, website, logo_url,
              address_line1, address_line2, city, state, country, postal_code, tax_id, registration_no
       FROM "${schemaName}".company_settings LIMIT 1`,
    );
    return row || {};
  }

  private async fetchLogoBuffer(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch {
      return null;
    }
  }

  private renderLetterhead(doc: InstanceType<typeof PDFDocument>, company: any, logoBuffer: Buffer | null) {
    const startY = 50;
    let textStartX = 50;

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, startY, { width: 40, height: 40 });
        textStartX = 100;
      } catch { /* skip */ }
    }

    if (company.company_name) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827')
         .text(company.company_name, textStartX, startY);
      if (company.tagline) {
        doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
           .text(company.tagline);
      }
    }

    const divY = Math.max(doc.y, startY + 42) + 6;
    doc.moveTo(50, divY).lineTo(545, divY).strokeColor('#e5e7eb').stroke();
    doc.y = divY + 12;
  }

  private renderFooter(doc: InstanceType<typeof PDFDocument>, company: any) {
    const parts: string[] = [];
    if (company.company_name) parts.push(company.company_name);
    const addrParts = [company.address_line1, company.address_line2, company.city, company.state, company.postal_code, company.country].filter(Boolean);
    if (addrParts.length) parts.push(addrParts.join(', '));

    const line2Parts: string[] = [];
    if (company.phone) line2Parts.push(company.phone);
    if (company.email) line2Parts.push(company.email);
    if (company.website) line2Parts.push(company.website);
    if (company.registration_no) line2Parts.push(`Reg: ${company.registration_no}`);
    if (company.tax_id) line2Parts.push(`Tax ID: ${company.tax_id}`);

    if (!parts.length && !line2Parts.length) return;

    const line1 = parts.join('  ·  ');
    const line2 = line2Parts.join('  ·  ');

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      const pageH = doc.page.height;
      const footerY = pageH - 50;

      doc.save();
      doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e5e7eb').stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#9ca3af');
      if (line1) {
        doc.text(line1, 50, footerY + 5, { width: 495, align: 'center', height: 10, ellipsis: true });
      }
      if (line2) {
        doc.text(line2, 50, footerY + 15, { width: 495, align: 'center', height: 10, ellipsis: true });
      }
      doc.restore();
    }
  }

  async generatePdf(schemaName: string, proposalId: string): Promise<Buffer> {
    const proposal = await this.findOne(schemaName, proposalId);
    const company = await this.getCompanyInfo(schemaName);
    const logoBuffer = company.logo_url ? await this.fetchLogoBuffer(company.logo_url) : null;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, margins: { top: 50, bottom: 70, left: 50, right: 50 }, autoFirstPage: true, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Company Letterhead ──
      this.renderLetterhead(doc, company, logoBuffer);

      // ── Title + Meta ──
      const metaY = doc.y;
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827')
        .text(proposal.title, 50, metaY, { width: 300, align: 'left' });

      // Right side: status + dates
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280');
      const statusLabel = proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1);
      doc.text(statusLabel, 380, metaY, { width: 165, align: 'right' });
      if (proposal.validUntil) {
        doc.text(`Valid Until: ${new Date(proposal.validUntil).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric'
        })}`, 380, metaY + 14, { width: 165, align: 'right' });
      }
      doc.text(`Currency: ${proposal.currency}`, 380, metaY + 28, { width: 165, align: 'right' });

      doc.y = Math.max(doc.y, metaY + 45);
      doc.moveDown(0.5);

      // ── Cover message ──
      if (proposal.coverMessage) {
        doc.fontSize(10).font('Helvetica').fillColor('#374151')
          .text(proposal.coverMessage, 50, doc.y, { width: 495, align: 'left' });
        doc.moveDown(1);
      }

      // ── Line items table ──
      if (proposal.lineItems && proposal.lineItems.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
          .text('Line Items', 50, doc.y, { align: 'left' });
        doc.moveDown(0.5);

        // Column headers
        const colX = { desc: 50, qty: 280, price: 340, disc: 410, total: 470 };
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280');
        doc.text('DESCRIPTION', colX.desc, doc.y, { continued: false, width: 220 });
        const headerY = doc.y - doc.currentLineHeight();
        doc.text('QTY',   colX.qty,   headerY, { width: 50, align: 'right' });
        doc.text('PRICE', colX.price, headerY, { width: 60, align: 'right' });
        doc.text('DISC',  colX.disc,  headerY, { width: 50, align: 'right' });
        doc.text('TOTAL', colX.total, headerY, { width: 70, align: 'right' });
        doc.moveDown(0.3);

        // Divider
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
        doc.moveDown(0.3);

        // Rows
        doc.fontSize(9).font('Helvetica').fillColor('#111827');
        for (const item of proposal.lineItems) {
          const rowY = doc.y;
          doc.text(item.description, colX.desc, rowY, { width: 220 });
          doc.text(String(item.quantity),           colX.qty,   rowY, { width: 50,  align: 'right' });
          doc.text(`${item.unitPrice.toFixed(2)}`,  colX.price, rowY, { width: 60,  align: 'right' });
          const discStr = item.discount
            ? item.discountType === 'fixed'
              ? item.discount.toFixed(2)
              : `${item.discount}%`
            : '—';
          doc.text(discStr,                         colX.disc,  rowY, { width: 50,  align: 'right' });
          doc.text(`${(item.total ?? 0).toFixed(2)}`, colX.total, rowY, { width: 70, align: 'right' });
          doc.moveDown(0.8);
        }

        // Total row
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827');
        const totalY = doc.y;
        doc.text('TOTAL', colX.disc, totalY, { width: 50, align: 'right' });
        doc.text(
          `${proposal.currency} ${proposal.totalAmount.toFixed(2)}`,
          colX.total, totalY, { width: 70, align: 'right' }
        );
        doc.moveDown(1.5);
      }

      // ── Terms ──
      if (proposal.terms) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
          .text('Terms & Conditions');
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').fillColor('#374151')
          .text(proposal.terms, { align: 'left' });
      }

      // ── Footer ──
      this.renderFooter(doc, company);

      doc.end();
    });
  }

  // ============================================================
  // SEND WITH EMAIL
  // ============================================================
  async sendWithEmail(
    schemaName: string,
    proposalId: string,
    userId: string,
    payload: { to: string[]; cc?: string[]; bcc?: string[]; subject?: string },
  ) {
    // 1. Call send() to update status
    await this.send(schemaName, proposalId, userId);

    // 2. Get updated proposal
    const proposal = await this.findOne(schemaName, proposalId);

    // 3. Generate PDF
    const pdfBuffer = await this.generatePdf(schemaName, proposalId);

    // 4. Build public link
    const publicLink = `${process.env.APP_URL || 'http://localhost:5173'}/proposals/public/${proposal.tenantId}/${proposal.publicToken}`;

    // 5. Send email via emailService
    await this.emailService.sendEmail({
      to: payload.to.join(', '),
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject || `Proposal: ${proposal.title}`,
      html: `
        <p>Please find your proposal attached.</p>
        <p><strong>${proposal.title}</strong></p>
        <p>You can also view it online: <a href="${publicLink}">${publicLink}</a></p>
        ${proposal.validUntil ? `<p>Valid until: ${new Date(proposal.validUntil).toLocaleDateString()}</p>` : ''}
        <p>Total: ${proposal.currency} ${proposal.totalAmount.toFixed(2)}</p>
      `,
      attachments: [{
        filename: `proposal-${proposal.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    return proposal;
  }

  // ============================================================
  // FIND SCHEMA BY TOKEN (for public endpoints)
  // ============================================================
  async findSchemaByToken(
    tenantId: string,
    token: string,
  ): Promise<{ schemaName: string }> {
    const [tenant] = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants
       WHERE id = $1 AND status = 'active'`,
      [tenantId],
    );
    if (!tenant) throw new NotFoundException('Proposal not found');

    try {
      const [row] = await this.dataSource.query(
        `SELECT id FROM "${tenant.schema_name}".proposals
         WHERE public_token = $1 AND deleted_at IS NULL LIMIT 1`,
        [token],
      );
      if (!row) throw new NotFoundException('Proposal not found');
      return { schemaName: tenant.schema_name };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new NotFoundException('Proposal not found');
    }
  }

  // ============================================================
  // APPROVAL STATUS
  // ============================================================
  async getApprovalStatus(schemaName: string, proposalId: string) {
    return this.approvalService.getEntityRequest(schemaName, 'proposals', proposalId, 'publish');
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async getMaxDiscountPercent(
    schemaName: string,
    proposalId: string,
  ): Promise<number> {
    const items = await this.dataSource.query(
      `SELECT discount, discount_type, unit_price, quantity
       FROM "${schemaName}".proposal_line_items
       WHERE proposal_id = $1`,
      [proposalId],
    );
    if (!items.length) return 0;
    let max = 0;
    for (const item of items) {
      const discount = parseFloat(item.discount) || 0;
      if (item.discount_type === 'percentage') {
        if (discount > max) max = discount;
      } else if (item.discount_type === 'fixed') {
        const unitPrice = parseFloat(item.unit_price) || 0;
        const qty = parseFloat(item.quantity) || 1;
        const subtotal = unitPrice * qty;
        if (subtotal > 0) {
          const pct = (discount / subtotal) * 100;
          if (pct > max) max = pct;
        }
      }
    }
    return max;
  }

  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discount: number,
    discountType: 'percentage' | 'fixed',
  ): number {
    const subtotal = quantity * unitPrice;
    if (discountType === 'fixed') {
      return Math.round((subtotal - discount) * 100) / 100;
    }
    return Math.round(subtotal * (1 - discount / 100) * 100) / 100;
  }

  private formatProposal(r: any) {
    return {
      id: r.id,
      opportunityId: r.opportunity_id,
      tenantId: r.tenant_id,
      title: r.title,
      coverMessage: r.cover_message,
      terms: r.terms,
      validUntil: r.valid_until,
      status: r.status,
      publicToken: r.public_token,
      currency: r.currency,
      totalAmount: parseFloat(r.total_amount) || 0,
      sentAt: r.sent_at,
      viewedAt: r.viewed_at,
      publishedAt: r.published_at,
      publishedBy: r.published_by,
      acceptedAt: r.accepted_at,
      declinedAt: r.declined_at,
      createdBy: r.created_by
        ? {
            id: r.created_by,
            firstName: r.created_by_first_name,
            lastName: r.created_by_last_name,
          }
        : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private formatLineItem(r: any) {
    return {
      id: r.id,
      proposalId: r.proposal_id,
      productId: r.product_id,
      productName: r.product_name || null,
      productCode: r.product_code || null,
      description: r.description,
      quantity: parseFloat(r.quantity) || 0,
      unitPrice: parseFloat(r.unit_price) || 0,
      discount: parseFloat(r.discount) || 0,
      discountType: r.discount_type,
      total: parseFloat(r.total) || 0,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    };
  }
}
