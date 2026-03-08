// ============================================================
// FILE: apps/api/src/modules/opportunities/invoices.controller.ts
//
// Authenticated endpoints for invoice CRUD + payments,
// standalone at /invoices (NOT nested under opportunities).
//
// Public endpoints placeholder for future Xero/Stripe webhooks.
//
// Permission module: 'deals' (same as opportunities/contracts)
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Request, Res, Headers, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { InvoicesService } from './invoices.service';
import { XeroService } from './xero.service';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSchema: string;
  tenantSlug: string;
}

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly xeroService: XeroService,
  ) {}

  @Get()
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'List invoices (filterable by opportunityId, accountId, status)' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query('opportunityId') opportunityId?: string,
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll(req.user.tenantSchema, {
      opportunityId,
      accountId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get invoice by ID (with line items + payments)' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.invoicesService.findOne(req.user.tenantSchema, id);
  }

  @Post()
  @RequirePermission('deals', 'create')
  @ApiOperation({ summary: 'Create an invoice (direct or from contract/proposal)' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() body: {
      sourceType?: 'contract' | 'proposal';
      sourceId?: string;
      opportunityId?: string;
      contractId?: string;
      proposalId?: string;
      accountId?: string;
      contactId?: string;
      title?: string;
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
  ) {
    if (body.sourceType && body.sourceId) {
      return this.invoicesService.createFromSource(
        req.user.tenantSchema,
        req.user.sub,
        body.sourceType,
        body.sourceId,
        { dueDate: body.dueDate, notes: body.notes, terms: body.terms },
      );
    }
    return this.invoicesService.create(
      req.user.tenantSchema,
      req.user.sub,
      body as any,
    );
  }

  @Put(':id')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Update a draft invoice' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      accountId?: string;
      contactId?: string;
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
  ) {
    return this.invoicesService.update(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Delete(':id')
  @RequirePermission('deals', 'delete')
  @ApiOperation({ summary: 'Soft-delete a draft invoice' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.invoicesService.delete(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/send')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Mark invoice as sent' })
  async send(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.invoicesService.send(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/cancel')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Cancel a draft or sent invoice' })
  async cancel(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.invoicesService.cancel(req.user.tenantSchema, id, req.user.sub);
  }

  @Get(':id/pdf')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Download invoice as PDF' })
  async downloadPdf(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.invoicesService.generatePdf(req.user.tenantSchema, id);
    const invoice = await this.invoicesService.findOne(req.user.tenantSchema, id);
    const filename = `invoice-${invoice.invoiceNumber?.toLowerCase() || id}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post(':id/send-email')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Send invoice by email with PDF attachment' })
  async sendByEmail(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { to: string[]; cc?: string[]; bcc?: string[]; subject?: string },
  ) {
    return this.invoicesService.sendByEmail(
      req.user.tenantSchema, id, req.user.sub, body,
    );
  }

  @Post(':id/push-xero')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Push invoice to Xero accounting' })
  async pushToXero(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const xeroInvoiceId = await this.xeroService.pushInvoice(
      req.user.tenantId, req.user.tenantSchema, id,
    );
    return { success: true, xeroInvoiceId };
  }

  @Post(':id/payments')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  async recordPayment(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: {
      amount: number;
      currency?: string;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      paidAt?: string;
    },
  ) {
    return this.invoicesService.recordPayment(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Get(':id/payments')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'List payments for an invoice' })
  async getPayments(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.invoicesService.getPayments(req.user.tenantSchema, id);
  }
}

// ============================================================
// PUBLIC CONTROLLER — no auth guard
// Placeholder for future Xero/Stripe webhook endpoints
// ============================================================
@ApiTags('Invoices Public')
@Controller('invoices/public')
export class InvoicesPublicController {
  constructor(private readonly xeroService: XeroService) {}

  @Post('xero/webhook')
  @ApiOperation({ summary: 'Xero webhook callback' })
  async xeroWebhook(
    @Headers('x-xero-tenant-schema') tenantSchema: string,
    @Body() body: { events?: Array<{ eventType: string; resourceId: string; tenantId?: string }> },
  ) {
    if (!tenantSchema || !body.events?.length) {
      return { received: true };
    }
    await this.xeroService.handleWebhook(tenantSchema, body.events);
    return { received: true };
  }

  // TODO: POST stripe/webhook — Stripe webhook callback
}
