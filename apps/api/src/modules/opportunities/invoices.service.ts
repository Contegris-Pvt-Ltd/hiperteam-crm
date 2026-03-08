// ============================================================
// FILE: apps/api/src/modules/opportunities/invoices.service.ts
//
// Full CRUD + payments + recurring for invoices.
//
// Follows contracts.service.ts patterns exactly:
//   - Raw SQL with parameterized queries
//   - Audit logging on all mutations
//   - formatInvoice() / formatLineItem() / formatPayment() for camelCase
// ============================================================
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import { AuditService } from '../shared/audit.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  // ============================================================
  // FIND ALL
  // ============================================================
  async findAll(
    schemaName: string,
    filters: {
      opportunityId?: string;
      accountId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: any[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['i.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.opportunityId) {
      conditions.push(`i.opportunity_id = $${idx}`);
      params.push(filters.opportunityId);
      idx++;
    }
    if (filters.accountId) {
      conditions.push(`i.account_id = $${idx}`);
      params.push(filters.accountId);
      idx++;
    }
    if (filters.status) {
      conditions.push(`i.status = $${idx}`);
      params.push(filters.status);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT i.id)::int AS total
       FROM "${schemaName}".invoices i
       WHERE ${whereClause}`,
      params,
    );

    const rows = await this.dataSource.query(
      `SELECT
         i.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         a.name AS account_name,
         c.first_name || ' ' || c.last_name AS contact_name,
         COUNT(ip.id)::int AS payment_count
       FROM "${schemaName}".invoices i
       LEFT JOIN "${schemaName}".users u ON u.id = i.created_by
       LEFT JOIN "${schemaName}".accounts a ON a.id = i.account_id
       LEFT JOIN "${schemaName}".contacts c ON c.id = i.contact_id
       LEFT JOIN "${schemaName}".invoice_payments ip ON ip.invoice_id = i.id
       WHERE ${whereClause}
       GROUP BY i.id, u.first_name, u.last_name, a.name, c.first_name, c.last_name
       ORDER BY i.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    const total = parseInt(countResult.total, 10) || 0;

    return {
      data: rows.map((r: any) => ({
        ...this.formatInvoice(r),
        createdByName: r.created_by_name || null,
        accountName: r.account_name || null,
        contactName: r.contact_name || null,
        paymentCount: parseInt(r.payment_count, 10) || 0,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // FIND ONE
  // ============================================================
  async findOne(schemaName: string, invoiceId: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT
         i.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         a.name AS account_name,
         a.xero_contact_id AS account_xero_contact_id,
         c.first_name || ' ' || c.last_name AS contact_name,
         c.email AS contact_email,
         c.xero_contact_id AS contact_xero_contact_id,
         json_agg(DISTINCT jsonb_build_object(
           'id', li.id,
           'productId', li.product_id,
           'description', li.description,
           'quantity', li.quantity,
           'unitPrice', li.unit_price,
           'discount', li.discount,
           'discountType', li.discount_type,
           'taxRate', li.tax_rate,
           'total', li.total,
           'sortOrder', li.sort_order
         )) FILTER (WHERE li.id IS NOT NULL) AS line_items,
         json_agg(DISTINCT jsonb_build_object(
           'id', ip.id,
           'amount', ip.amount,
           'currency', ip.currency,
           'paymentMethod', ip.payment_method,
           'reference', ip.reference,
           'notes', ip.notes,
           'paidAt', ip.paid_at,
           'xeroPaymentId', ip.xero_payment_id
         )) FILTER (WHERE ip.id IS NOT NULL) AS payments
       FROM "${schemaName}".invoices i
       LEFT JOIN "${schemaName}".users u ON u.id = i.created_by
       LEFT JOIN "${schemaName}".accounts a ON a.id = i.account_id
       LEFT JOIN "${schemaName}".contacts c ON c.id = i.contact_id
       LEFT JOIN "${schemaName}".invoice_line_items li ON li.invoice_id = i.id
       LEFT JOIN "${schemaName}".invoice_payments ip ON ip.invoice_id = i.id
       WHERE i.id = $1 AND i.deleted_at IS NULL
       GROUP BY i.id, u.first_name, u.last_name,
                a.name, a.xero_contact_id,
                c.first_name, c.last_name, c.email, c.xero_contact_id`,
      [invoiceId],
    );

    if (!rows.length) throw new NotFoundException('Invoice not found');

    const r = rows[0];
    return {
      ...this.formatInvoice(r),
      createdByName: r.created_by_name || null,
      accountName: r.account_name || null,
      accountXeroContactId: r.account_xero_contact_id || null,
      contactName: r.contact_name || null,
      contactEmail: r.contact_email || null,
      contactXeroContactId: r.contact_xero_contact_id || null,
      lineItems: (r.line_items || []).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      payments: r.payments || [],
    };
  }

  // ============================================================
  // CREATE
  // ============================================================
  async create(
    schemaName: string,
    userId: string,
    dto: {
      opportunityId?: string;
      contractId?: string;
      proposalId?: string;
      accountId?: string;
      contactId?: string;
      title: string;
      currency?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
      terms?: string;
      isRecurring?: boolean;
      recurrenceInterval?: string;
      recurrenceEndDate?: string;
      lineItems?: Array<{
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        discountType?: 'percentage' | 'fixed';
        taxRate?: number;
        sortOrder?: number;
      }>;
    },
  ): Promise<any> {
    // 1. Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(schemaName);

    // 2. Calculate totals from line items
    const items = (dto.lineItems || []).map(li => ({
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      discount: li.discount || 0,
      discountType: (li.discountType || 'percentage') as 'percentage' | 'fixed',
      taxRate: li.taxRate || 0,
    }));
    const totals = this.calculateTotals(items);

    // 3. Determine next_invoice_date for recurring
    let nextInvoiceDate: string | null = null;
    if (dto.isRecurring && dto.recurrenceInterval && dto.issueDate) {
      nextInvoiceDate = this.computeNextDate(dto.issueDate, dto.recurrenceInterval);
    }

    // 4. Insert invoice
    const [invoice] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".invoices
       (invoice_number, opportunity_id, contract_id, proposal_id,
        account_id, contact_id, title, status, currency,
        subtotal, discount_amount, tax_amount, total_amount,
        amount_paid, amount_due,
        issue_date, due_date, notes, terms,
        is_recurring, recurrence_interval, recurrence_end_date, next_invoice_date,
        created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11,$12,0,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        invoiceNumber,
        dto.opportunityId || null,
        dto.contractId || null,
        dto.proposalId || null,
        dto.accountId || null,
        dto.contactId || null,
        dto.title,
        dto.currency || 'USD',
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.totalAmount,
        totals.totalAmount, // amount_due = totalAmount initially
        dto.issueDate || new Date().toISOString().slice(0, 10),
        dto.dueDate || null,
        dto.notes || null,
        dto.terms || null,
        dto.isRecurring ?? false,
        dto.recurrenceInterval || null,
        dto.recurrenceEndDate || null,
        nextInvoiceDate,
        userId,
      ],
    );

    // 5. Insert line items
    if (dto.lineItems && dto.lineItems.length > 0) {
      for (let i = 0; i < dto.lineItems.length; i++) {
        const li = dto.lineItems[i];
        const lineTotal = this.calculateLineTotal(
          li.quantity, li.unitPrice, li.discount || 0,
          (li.discountType || 'percentage') as 'percentage' | 'fixed',
          li.taxRate || 0,
        );

        await this.dataSource.query(
          `INSERT INTO "${schemaName}".invoice_line_items
           (invoice_id, product_id, description, quantity, unit_price,
            discount, discount_type, tax_rate, total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            invoice.id,
            li.productId || null,
            li.description,
            li.quantity,
            li.unitPrice,
            li.discount || 0,
            li.discountType || 'percentage',
            li.taxRate || 0,
            lineTotal,
            li.sortOrder ?? i,
          ],
        );
      }
    }

    // 6. Audit
    await this.auditService.log(schemaName, {
      entityType: 'invoices',
      entityId: invoice.id,
      action: 'create',
      changes: {},
      newValues: {
        invoiceNumber,
        title: dto.title,
        totalAmount: totals.totalAmount,
      },
      performedBy: userId,
    });

    // 7. Return
    return this.findOne(schemaName, invoice.id);
  }

  // ============================================================
  // CREATE FROM SOURCE (contract or proposal)
  // ============================================================
  async createFromSource(
    schemaName: string,
    userId: string,
    sourceType: 'contract' | 'proposal',
    sourceId: string,
    dto?: Partial<{ dueDate: string; notes: string; terms: string }>,
  ): Promise<any> {
    if (sourceType === 'contract') {
      // Fetch contract
      const [contract] = await this.dataSource.query(
        `SELECT c.*, o.account_id
         FROM "${schemaName}".contracts c
         LEFT JOIN "${schemaName}".opportunities o ON o.id = c.opportunity_id
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [sourceId],
      );
      if (!contract) throw new NotFoundException('Contract not found');

      // Try to get line items from the contract's proposal
      let lineItems: any[] = [];
      if (contract.proposal_id) {
        lineItems = await this.dataSource.query(
          `SELECT description, quantity, unit_price, discount, discount_type
           FROM "${schemaName}".proposal_line_items
           WHERE proposal_id = $1
           ORDER BY sort_order ASC`,
          [contract.proposal_id],
        );
      }

      // If no line items from proposal, create a single line from contract value
      const mappedLineItems = lineItems.length > 0
        ? lineItems.map((li: any, i: number) => ({
            description: li.description,
            quantity: parseFloat(li.quantity) || 1,
            unitPrice: parseFloat(li.unit_price) || 0,
            discount: parseFloat(li.discount) || 0,
            discountType: (li.discount_type || 'percentage') as 'percentage' | 'fixed',
            taxRate: 0,
            sortOrder: i,
          }))
        : [{
            description: contract.title,
            quantity: 1,
            unitPrice: parseFloat(contract.value) || 0,
            discount: 0,
            discountType: 'percentage' as const,
            taxRate: 0,
            sortOrder: 0,
          }];

      return this.create(schemaName, userId, {
        opportunityId: contract.opportunity_id || undefined,
        contractId: sourceId,
        proposalId: contract.proposal_id || undefined,
        accountId: contract.account_id || undefined,
        title: `Invoice for ${contract.title}`,
        currency: contract.currency || 'USD',
        dueDate: dto?.dueDate || undefined,
        notes: dto?.notes || undefined,
        terms: dto?.terms || contract.terms || undefined,
        lineItems: mappedLineItems,
      });
    }

    if (sourceType === 'proposal') {
      // Fetch proposal
      const [proposal] = await this.dataSource.query(
        `SELECT p.*, o.account_id
         FROM "${schemaName}".proposals p
         LEFT JOIN "${schemaName}".opportunities o ON o.id = p.opportunity_id
         WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [sourceId],
      );
      if (!proposal) throw new NotFoundException('Proposal not found');

      // Fetch proposal line items
      const lineItems = await this.dataSource.query(
        `SELECT description, quantity, unit_price, discount, discount_type
         FROM "${schemaName}".proposal_line_items
         WHERE proposal_id = $1
         ORDER BY sort_order ASC`,
        [sourceId],
      );

      const mappedLineItems = lineItems.length > 0
        ? lineItems.map((li: any, i: number) => ({
            description: li.description,
            quantity: parseFloat(li.quantity) || 1,
            unitPrice: parseFloat(li.unit_price) || 0,
            discount: parseFloat(li.discount) || 0,
            discountType: (li.discount_type || 'percentage') as 'percentage' | 'fixed',
            taxRate: 0,
            sortOrder: i,
          }))
        : [{
            description: proposal.title,
            quantity: 1,
            unitPrice: parseFloat(proposal.total_amount) || 0,
            discount: 0,
            discountType: 'percentage' as const,
            taxRate: 0,
            sortOrder: 0,
          }];

      return this.create(schemaName, userId, {
        opportunityId: proposal.opportunity_id || undefined,
        proposalId: sourceId,
        accountId: proposal.account_id || undefined,
        title: `Invoice for ${proposal.title}`,
        currency: proposal.currency || 'USD',
        dueDate: dto?.dueDate || undefined,
        notes: dto?.notes || undefined,
        terms: dto?.terms || proposal.terms || undefined,
        lineItems: mappedLineItems,
      });
    }

    throw new BadRequestException('Invalid source type');
  }

  // ============================================================
  // UPDATE (draft only)
  // ============================================================
  async update(
    schemaName: string,
    invoiceId: string,
    userId: string,
    dto: Partial<{
      title: string;
      accountId: string;
      contactId: string;
      currency: string;
      issueDate: string;
      dueDate: string;
      notes: string;
      terms: string;
      isRecurring: boolean;
      recurrenceInterval: string;
      recurrenceEndDate: string;
      lineItems: Array<{
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        discountType?: 'percentage' | 'fixed';
        taxRate?: number;
        sortOrder?: number;
      }>;
    }>,
  ): Promise<any> {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".invoices WHERE id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    );
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be edited');
    }

    // 1. Update scalar fields
    const fieldMap: Record<string, string> = {
      title: 'title',
      accountId: 'account_id',
      contactId: 'contact_id',
      currency: 'currency',
      issueDate: 'issue_date',
      dueDate: 'due_date',
      notes: 'notes',
      terms: 'terms',
      isRecurring: 'is_recurring',
      recurrenceInterval: 'recurrence_interval',
      recurrenceEndDate: 'recurrence_end_date',
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

    // 2. Replace line items if provided and recalculate totals
    if (dto.lineItems !== undefined) {
      await this.dataSource.query(
        `DELETE FROM "${schemaName}".invoice_line_items WHERE invoice_id = $1`,
        [invoiceId],
      );

      const items = dto.lineItems.map(li => ({
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discount: li.discount || 0,
        discountType: (li.discountType || 'percentage') as 'percentage' | 'fixed',
        taxRate: li.taxRate || 0,
      }));
      const totals = this.calculateTotals(items);

      // Recalculate amount_due based on existing payments
      const amountPaid = parseFloat(existing.amount_paid) || 0;
      const newAmountDue = Math.round((totals.totalAmount - amountPaid) * 100) / 100;

      updates.push(`subtotal = $${idx}`);
      params.push(totals.subtotal);
      idx++;
      updates.push(`discount_amount = $${idx}`);
      params.push(totals.discountAmount);
      idx++;
      updates.push(`tax_amount = $${idx}`);
      params.push(totals.taxAmount);
      idx++;
      updates.push(`total_amount = $${idx}`);
      params.push(totals.totalAmount);
      idx++;
      updates.push(`amount_due = $${idx}`);
      params.push(newAmountDue);
      idx++;

      for (let i = 0; i < dto.lineItems.length; i++) {
        const li = dto.lineItems[i];
        const lineTotal = this.calculateLineTotal(
          li.quantity, li.unitPrice, li.discount || 0,
          (li.discountType || 'percentage') as 'percentage' | 'fixed',
          li.taxRate || 0,
        );

        await this.dataSource.query(
          `INSERT INTO "${schemaName}".invoice_line_items
           (invoice_id, product_id, description, quantity, unit_price,
            discount, discount_type, tax_rate, total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            invoiceId,
            li.productId || null,
            li.description,
            li.quantity,
            li.unitPrice,
            li.discount || 0,
            li.discountType || 'percentage',
            li.taxRate || 0,
            lineTotal,
            li.sortOrder ?? i,
          ],
        );
      }
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(invoiceId);
      await this.dataSource.query(
        `UPDATE "${schemaName}".invoices SET ${updates.join(', ')} WHERE id = $${idx}`,
        params,
      );
    }

    // 3. Audit
    await this.auditService.log(schemaName, {
      entityType: 'invoices',
      entityId: invoiceId,
      action: 'update',
      changes: {},
      newValues: dto as unknown as Record<string, unknown>,
      performedBy: userId,
    });

    return this.findOne(schemaName, invoiceId);
  }

  // ============================================================
  // SEND
  // ============================================================
  async send(
    schemaName: string,
    invoiceId: string,
    userId: string,
  ): Promise<any> {
    const [invoice] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".invoices WHERE id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be sent');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".invoices SET status = 'sent', updated_at = NOW() WHERE id = $1`,
      [invoiceId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'invoices',
      entityId: invoiceId,
      action: 'update',
      changes: { status: { from: 'draft', to: 'sent' } },
      newValues: { status: 'sent' },
      performedBy: userId,
    });

    return this.findOne(schemaName, invoiceId);
  }

  // ============================================================
  // RECORD PAYMENT
  // ============================================================
  async recordPayment(
    schemaName: string,
    invoiceId: string,
    userId: string,
    dto: {
      amount: number;
      currency?: string;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      paidAt?: string;
    },
  ): Promise<any> {
    const invoice = await this.findOne(schemaName, invoiceId);

    if (['cancelled', 'void', 'draft'].includes(invoice.status)) {
      throw new BadRequestException('Payments cannot be recorded for invoices in this status');
    }

    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    if (dto.amount > invoice.amountDue) {
      throw new BadRequestException('Payment amount exceeds amount due');
    }

    // 1. Insert payment
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".invoice_payments
       (invoice_id, amount, currency, payment_method, reference, notes, paid_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        invoiceId,
        dto.amount,
        dto.currency || invoice.currency,
        dto.paymentMethod || 'manual',
        dto.reference || null,
        dto.notes || null,
        dto.paidAt || new Date().toISOString(),
        userId,
      ],
    );

    // 2. Calculate new totals
    const newAmountPaid = Math.round((invoice.amountPaid + dto.amount) * 100) / 100;
    const newAmountDue = Math.round((invoice.totalAmount - newAmountPaid) * 100) / 100;

    // 3. Determine new status
    let newStatus: string;
    let paidAt: string | null = null;
    if (newAmountDue <= 0) {
      newStatus = 'paid';
      paidAt = new Date().toISOString();
    } else {
      newStatus = 'partially_paid';
    }

    // 4. Update invoice
    await this.dataSource.query(
      `UPDATE "${schemaName}".invoices
       SET amount_paid = $2, amount_due = $3, status = $4, paid_at = $5, updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, newAmountPaid, newAmountDue, newStatus, paidAt],
    );

    // 5. Audit
    await this.auditService.log(schemaName, {
      entityType: 'invoices',
      entityId: invoiceId,
      action: 'update',
      changes: {
        status: { from: invoice.status, to: newStatus },
        amountPaid: { from: invoice.amountPaid, to: newAmountPaid },
      },
      newValues: {
        paymentAmount: dto.amount,
        paymentMethod: dto.paymentMethod || 'manual',
        newAmountPaid,
        newAmountDue,
      },
      performedBy: userId,
    });

    return this.findOne(schemaName, invoiceId);
  }

  // ============================================================
  // CANCEL
  // ============================================================
  async cancel(
    schemaName: string,
    invoiceId: string,
    userId: string,
  ): Promise<any> {
    const [invoice] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".invoices WHERE id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['draft', 'sent'].includes(invoice.status)) {
      throw new BadRequestException('Only draft or sent invoices can be cancelled');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".invoices SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [invoiceId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'invoices',
      entityId: invoiceId,
      action: 'update',
      changes: { status: { from: invoice.status, to: 'cancelled' } },
      newValues: { status: 'cancelled' },
      performedBy: userId,
    });

    return this.findOne(schemaName, invoiceId);
  }

  // ============================================================
  // MARK OVERDUE (bulk — for scheduled job)
  // ============================================================
  async markOverdue(schemaName: string): Promise<number> {
    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".invoices
       SET status = 'overdue', updated_at = NOW()
       WHERE status = 'sent'
         AND due_date < CURRENT_DATE
         AND deleted_at IS NULL`,
    );

    return result[1] || 0;
  }

  // ============================================================
  // DELETE (soft — draft only)
  // ============================================================
  async delete(
    schemaName: string,
    invoiceId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const [invoice] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".invoices WHERE id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be deleted');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".invoices SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [invoiceId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'invoices',
      entityId: invoiceId,
      action: 'delete',
      changes: {},
      previousValues: this.formatInvoice(invoice),
      performedBy: userId,
    });

    return { message: 'Invoice deleted' };
  }

  // ============================================================
  // GET PAYMENTS
  // ============================================================
  async getPayments(
    schemaName: string,
    invoiceId: string,
  ): Promise<any[]> {
    const rows = await this.dataSource.query(
      `SELECT ip.*, u.first_name || ' ' || u.last_name AS recorded_by_name
       FROM "${schemaName}".invoice_payments ip
       LEFT JOIN "${schemaName}".users u ON u.id = ip.recorded_by
       WHERE ip.invoice_id = $1
       ORDER BY ip.paid_at DESC`,
      [invoiceId],
    );

    return rows.map((r: any) => this.formatPayment(r));
  }

  // ============================================================
  // GENERATE PDF
  // ============================================================
  async generatePdf(schemaName: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.findOne(schemaName, invoiceId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Header ──
      doc.fontSize(22).font('Helvetica-Bold')
         .fillColor('#111827').text('INVOICE', 50, 50);

      // Invoice number + status top right
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
         .text(invoice.invoiceNumber, 400, 50, { width: 145, align: 'right' });
      doc.fontSize(9).text(invoice.status.toUpperCase().replace(/_/g, ' '),
         400, 65, { width: 145, align: 'right' });

      doc.moveDown(2);

      // ── Bill To ──
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280')
         .text('BILL TO');
      doc.fontSize(11).font('Helvetica').fillColor('#111827')
         .text(invoice.accountName || invoice.contactName || 'Client');
      if (invoice.contactEmail) {
        doc.fontSize(9).fillColor('#6b7280').text(invoice.contactEmail);
      }

      // ── Dates (right column) ──
      const dateY = doc.y - 40;
      if (invoice.issueDate) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280')
           .text('ISSUE DATE', 350, dateY, { width: 100 });
        doc.fontSize(9).font('Helvetica').fillColor('#111827')
           .text(new Date(invoice.issueDate).toLocaleDateString('en-US', {
             month: 'long', day: 'numeric', year: 'numeric',
           }), 350, dateY + 12, { width: 100 });
      }

      if (invoice.dueDate) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280')
           .text('DUE DATE', 460, dateY, { width: 85 });
        doc.fontSize(9).font('Helvetica').fillColor('#111827')
           .text(new Date(invoice.dueDate).toLocaleDateString('en-US', {
             month: 'long', day: 'numeric', year: 'numeric',
           }), 460, dateY + 12, { width: 85 });
      }

      doc.moveDown(2);

      // ── Line items table ──
      if (invoice.lineItems && invoice.lineItems.length > 0) {
        const colX = { desc: 50, qty: 280, price: 340, disc: 400, tax: 450, total: 490 };
        const tableY = doc.y;

        // Header row background
        doc.rect(50, tableY, 495, 18).fill('#f3f4f6');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151');
        doc.text('DESCRIPTION', colX.desc + 4, tableY + 5, { width: 220 });
        const hY = tableY + 5;
        doc.text('QTY',   colX.qty,   hY, { width: 55,  align: 'right' });
        doc.text('PRICE', colX.price, hY, { width: 55,  align: 'right' });
        doc.text('DISC',  colX.disc,  hY, { width: 45,  align: 'right' });
        doc.text('TAX%',  colX.tax,   hY, { width: 35,  align: 'right' });
        doc.text('TOTAL', colX.total, hY, { width: 55,  align: 'right' });

        doc.moveDown(0.2);
        let rowY = tableY + 22;

        doc.fontSize(9).font('Helvetica').fillColor('#111827');
        for (const item of invoice.lineItems) {
          doc.text(item.description, colX.desc, rowY, { width: 225 });
          doc.text(String(item.quantity),
                   colX.qty, rowY, { width: 55, align: 'right' });
          doc.text((parseFloat(item.unitPrice) || 0).toFixed(2),
                   colX.price, rowY, { width: 55, align: 'right' });
          const discStr = item.discount
            ? item.discountType === 'fixed'
              ? (parseFloat(item.discount) || 0).toFixed(2)
              : `${item.discount}%`
            : '—';
          doc.text(discStr, colX.disc, rowY, { width: 45, align: 'right' });
          doc.text(item.taxRate ? `${item.taxRate}%` : '—',
                   colX.tax, rowY, { width: 35, align: 'right' });
          doc.text((parseFloat(item.total) || 0).toFixed(2),
                   colX.total, rowY, { width: 55, align: 'right' });
          rowY += 18;
          doc.moveTo(50, rowY - 4).lineTo(545, rowY - 4)
             .strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        }

        // ── Totals block ──
        rowY += 8;
        const totalsX = 380;
        doc.fontSize(9).font('Helvetica').fillColor('#374151');

        doc.text('Subtotal:', totalsX, rowY, { width: 100 });
        doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`,
                 totalsX + 105, rowY, { width: 55, align: 'right' });
        rowY += 16;

        if (invoice.discountAmount > 0) {
          doc.text('Discount:', totalsX, rowY, { width: 100 });
          doc.text(`- ${invoice.currency} ${invoice.discountAmount.toFixed(2)}`,
                   totalsX + 105, rowY, { width: 55, align: 'right' });
          rowY += 16;
        }

        if (invoice.taxAmount > 0) {
          doc.text('Tax:', totalsX, rowY, { width: 100 });
          doc.text(`${invoice.currency} ${invoice.taxAmount.toFixed(2)}`,
                   totalsX + 105, rowY, { width: 55, align: 'right' });
          rowY += 16;
        }

        // Total line
        doc.moveTo(totalsX, rowY).lineTo(545, rowY)
           .strokeColor('#111827').lineWidth(1).stroke();
        rowY += 6;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827');
        doc.text('Total:', totalsX, rowY, { width: 100 });
        doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
                 totalsX + 105, rowY, { width: 55, align: 'right' });

        if (invoice.amountPaid > 0) {
          rowY += 20;
          doc.fontSize(9).font('Helvetica').fillColor('#374151');
          doc.text('Amount Paid:', totalsX, rowY, { width: 100 });
          doc.text(`${invoice.currency} ${invoice.amountPaid.toFixed(2)}`,
                   totalsX + 105, rowY, { width: 55, align: 'right' });
          rowY += 16;
          doc.fontSize(10).font('Helvetica-Bold')
             .fillColor(invoice.amountDue <= 0 ? '#16a34a' : '#dc2626');
          doc.text('Amount Due:', totalsX, rowY, { width: 100 });
          doc.text(`${invoice.currency} ${invoice.amountDue.toFixed(2)}`,
                   totalsX + 105, rowY, { width: 55, align: 'right' });
        }
      }

      // ── Notes ──
      if (invoice.notes) {
        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280').text('NOTES');
        doc.fontSize(9).font('Helvetica').fillColor('#374151').text(invoice.notes);
      }

      // ── Terms ──
      if (invoice.terms) {
        doc.moveDown(1);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#6b7280')
           .text('TERMS & CONDITIONS');
        doc.fontSize(9).font('Helvetica').fillColor('#374151').text(invoice.terms);
      }

      doc.end();
    });
  }

  // ============================================================
  // SEND BY EMAIL
  // ============================================================
  async sendByEmail(
    schemaName: string,
    invoiceId: string,
    userId: string,
    payload: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
    },
  ): Promise<any> {
    // 1. Get invoice
    const invoice = await this.findOne(schemaName, invoiceId);

    // 2. Generate PDF
    const pdfBuffer = await this.generatePdf(schemaName, invoiceId);

    // 3. Update status to 'sent' (only if still draft)
    if (invoice.status === 'draft') {
      await this.send(schemaName, invoiceId, userId);
    }

    // 4. Build filename
    const filename = `invoice-${invoice.invoiceNumber.toLowerCase()}.pdf`;

    // 5. Send email
    await this.emailService.sendEmail({
      to: payload.to.join(', '),
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject || `Invoice ${invoice.invoiceNumber}`,
      html: `
        <p>Please find your invoice attached.</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr>
            <td style="padding:8px;color:#6b7280;font-size:14px">Invoice</td>
            <td style="padding:8px;font-size:14px">${invoice.invoiceNumber}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px;color:#6b7280;font-size:14px">Amount Due</td>
            <td style="padding:8px;font-size:14px;font-weight:bold">
              ${invoice.currency} ${invoice.amountDue.toFixed(2)}
            </td>
          </tr>
          ${invoice.dueDate ? `
          <tr>
            <td style="padding:8px;color:#6b7280;font-size:14px">Due Date</td>
            <td style="padding:8px;font-size:14px">
              ${new Date(invoice.dueDate).toLocaleDateString()}
            </td>
          </tr>` : ''}
        </table>
      `,
      attachments: [{
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    // 6. Return updated invoice
    return this.findOne(schemaName, invoiceId);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async generateInvoiceNumber(schemaName: string): Promise<string> {
    const [seq] = await this.dataSource.query(
      `SELECT 'INV-' || LPAD(nextval('"${schemaName}".invoice_number_seq')::text, 6, '0') AS invoice_number`,
    );
    return seq.invoice_number;
  }

  private calculateTotals(
    lineItems: Array<{
      quantity: number;
      unitPrice: number;
      discount: number;
      discountType: 'percentage' | 'fixed';
      taxRate: number;
    }>,
  ): { subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number } {
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    for (const li of lineItems) {
      const lineSub = li.quantity * li.unitPrice;
      subtotal += lineSub;

      let afterDiscount: number;
      if (li.discountType === 'fixed') {
        afterDiscount = lineSub - li.discount;
        discountAmount += li.discount;
      } else {
        const disc = lineSub * (li.discount / 100);
        afterDiscount = lineSub - disc;
        discountAmount += disc;
      }

      const tax = afterDiscount * (li.taxRate / 100);
      taxAmount += tax;
    }

    const totalAmount = subtotal - discountAmount + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discount: number,
    discountType: 'percentage' | 'fixed',
    taxRate: number,
  ): number {
    const lineSub = quantity * unitPrice;
    let afterDiscount: number;
    if (discountType === 'fixed') {
      afterDiscount = lineSub - discount;
    } else {
      afterDiscount = lineSub * (1 - discount / 100);
    }
    const total = afterDiscount * (1 + taxRate / 100);
    return Math.round(total * 100) / 100;
  }

  private computeNextDate(issueDate: string, interval: string): string {
    const d = new Date(issueDate);
    switch (interval) {
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'quarterly':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'annually':
        d.setFullYear(d.getFullYear() + 1);
        break;
    }
    return d.toISOString().slice(0, 10);
  }

  private formatInvoice(r: any) {
    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      opportunityId: r.opportunity_id,
      contractId: r.contract_id,
      proposalId: r.proposal_id,
      accountId: r.account_id,
      contactId: r.contact_id,
      title: r.title,
      status: r.status,
      currency: r.currency,
      subtotal: parseFloat(r.subtotal) || 0,
      discountAmount: parseFloat(r.discount_amount) || 0,
      taxAmount: parseFloat(r.tax_amount) || 0,
      totalAmount: parseFloat(r.total_amount) || 0,
      amountPaid: parseFloat(r.amount_paid) || 0,
      amountDue: parseFloat(r.amount_due) || 0,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      paidAt: r.paid_at,
      notes: r.notes,
      terms: r.terms,
      isRecurring: r.is_recurring,
      recurrenceInterval: r.recurrence_interval,
      recurrenceEndDate: r.recurrence_end_date,
      nextInvoiceDate: r.next_invoice_date,
      xeroInvoiceId: r.xero_invoice_id,
      xeroStatus: r.xero_status,
      stripePaymentId: r.stripe_payment_id,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private formatPayment(r: any) {
    return {
      id: r.id,
      invoiceId: r.invoice_id,
      amount: parseFloat(r.amount) || 0,
      currency: r.currency,
      paymentMethod: r.payment_method,
      reference: r.reference,
      notes: r.notes,
      paidAt: r.paid_at,
      recordedBy: r.recorded_by,
      recordedByName: r.recorded_by_name || null,
      xeroPaymentId: r.xero_payment_id,
      createdAt: r.created_at,
    };
  }
}
