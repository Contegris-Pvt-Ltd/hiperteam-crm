// ============================================================
// FILE: apps/api/src/modules/opportunities/proposals.controller.ts
//
// Authenticated endpoints for proposal CRUD + send,
// nested under /opportunities/:opportunityId/proposals
//
// Public endpoints (accept/decline/view by token) are stubbed
// in ProposalsPublicController — pending tenant resolution strategy.
//
// Permission module: 'deals' (same as opportunities)
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Request, Req, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { ProposalsService } from './proposals.service';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSchema: string;
  tenantSlug: string;
}

@ApiTags('Proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('opportunities/:opportunityId/proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'List proposals for an opportunity' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Param('opportunityId') opportunityId: string,
  ) {
    return this.proposalsService.findAll(req.user.tenantSchema, opportunityId);
  }

  @Get(':id')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get proposal by ID' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.proposalsService.findOne(req.user.tenantSchema, id);
  }

  @Get(':id/pdf')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Download proposal as PDF' })
  async downloadPdf(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.proposalsService.generatePdf(req.user.tenantSchema, id);
    const proposal = await this.proposalsService.findOne(req.user.tenantSchema, id);
    const filename = `proposal-${proposal.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post()
  @RequirePermission('deals', 'create')
  @ApiOperation({ summary: 'Create a new proposal' })
  async create(
    @Request() req: { user: JwtPayload },
    @Param('opportunityId') opportunityId: string,
    @Body() body: {
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
    return this.proposalsService.create(req.user.tenantSchema, req.user.tenantId, opportunityId, req.user.sub, body);
  }

  @Put(':id')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Update a draft proposal' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: {
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
    return this.proposalsService.update(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Delete(':id')
  @RequirePermission('deals', 'delete')
  @ApiOperation({ summary: 'Soft-delete a draft proposal' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.proposalsService.delete(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/publish')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Publish a draft proposal (locks it for sending)' })
  async publish(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.proposalsService.publish(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/send')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Send a published proposal (changes status to sent)' })
  async send(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.proposalsService.send(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/send-email')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Send proposal via email with PDF attachment' })
  async sendWithEmail(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { to: string[]; cc?: string[]; bcc?: string[]; subject?: string },
  ) {
    return this.proposalsService.sendWithEmail(req.user.tenantSchema, id, req.user.sub, body);
  }
}

// ============================================================
// PUBLIC CONTROLLER — no auth guard
// ============================================================
@ApiTags('Proposals Public')
@Controller('proposals/public')
export class ProposalsPublicController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get(':tenantId/:token')
  @ApiOperation({ summary: 'View proposal by public token (no auth)' })
  async viewByToken(
    @Param('tenantId') tenantId: string,
    @Param('token') token: string,
    @Req() req: any,
  ) {
    const { schemaName } = await this.proposalsService.findSchemaByToken(tenantId, token);
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await this.proposalsService.trackView(schemaName, token, ip, userAgent);
    return this.proposalsService.findByToken(schemaName, token);
  }

  @Post(':tenantId/:token/accept')
  @ApiOperation({ summary: 'Accept a proposal by public token (no auth)' })
  async acceptPublic(
    @Param('tenantId') tenantId: string,
    @Param('token') token: string,
  ) {
    const { schemaName } = await this.proposalsService.findSchemaByToken(tenantId, token);
    return this.proposalsService.accept(schemaName, token);
  }

  @Post(':tenantId/:token/decline')
  @ApiOperation({ summary: 'Decline a proposal by public token (no auth)' })
  async declinePublic(
    @Param('tenantId') tenantId: string,
    @Param('token') token: string,
  ) {
    const { schemaName } = await this.proposalsService.findSchemaByToken(tenantId, token);
    return this.proposalsService.decline(schemaName, token);
  }
}
