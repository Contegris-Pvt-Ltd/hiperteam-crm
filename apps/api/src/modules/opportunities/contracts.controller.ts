// ============================================================
// FILE: apps/api/src/modules/opportunities/contracts.controller.ts
//
// Authenticated endpoints for contract CRUD + signing workflow,
// nested under /opportunities/:opportunityId/contracts
//
// Public endpoints (sign/decline by token) for external signatories.
//
// Permission module: 'deals' (same as opportunities)
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Request, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { ContractsService } from './contracts.service';
import { DocuSignService } from './docusign.service';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSchema: string;
  tenantSlug: string;
}

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('opportunities/:opportunityId/contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'List contracts for an opportunity' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Param('opportunityId') opportunityId: string,
  ) {
    return this.contractsService.findAll(req.user.tenantSchema, opportunityId);
  }

  @Get(':id')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get contract by ID' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contractsService.findOne(req.user.tenantSchema, id);
  }

  @Post()
  @RequirePermission('deals', 'create')
  @ApiOperation({ summary: 'Create a contract (optionally from a proposal)' })
  async create(
    @Request() req: { user: JwtPayload },
    @Param('opportunityId') opportunityId: string,
    @Body() body: {
      proposalId?: string;
      title?: string;
      type?: string;
      value?: number;
      currency?: string;
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
  ) {
    if (body.proposalId) {
      return this.contractsService.createFromProposal(
        req.user.tenantSchema, opportunityId, body.proposalId, req.user.sub, body,
      );
    }
    return this.contractsService.create(
      req.user.tenantSchema, opportunityId, req.user.sub, body as any,
    );
  }

  @Put(':id')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Update a draft contract' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      type?: string;
      value?: number;
      currency?: string;
      startDate?: string;
      endDate?: string;
      renewalDate?: string;
      autoRenewal?: boolean;
      terms?: string;
      signMode?: string;
    },
  ) {
    return this.contractsService.update(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Delete(':id')
  @RequirePermission('deals', 'delete')
  @ApiOperation({ summary: 'Soft-delete a draft contract' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contractsService.delete(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/send')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Send contract for signing' })
  async sendForSigning(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contractsService.sendForSigning(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/resend')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Resend signing emails to unsigned signatories' })
  async resendEmails(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contractsService.resendEmails(req.user.tenantSchema, id, req.user.sub);
  }

  @Post(':id/terminate')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Terminate an active contract' })
  async terminate(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.contractsService.terminate(req.user.tenantSchema, id, req.user.sub, body.reason);
  }

  @Post(':id/signatories')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Add a signatory to a draft contract' })
  async addSignatory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: {
      signatoryType: 'internal' | 'external';
      signOrder: number;
      userId?: string;
      contactId?: string;
      name: string;
      email: string;
    },
  ) {
    return this.contractsService.addSignatory(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Delete(':id/signatories/:signatoryId')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Remove a signatory from a draft contract' })
  async removeSignatory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('signatoryId') signatoryId: string,
  ) {
    return this.contractsService.removeSignatory(req.user.tenantSchema, id, signatoryId, req.user.sub);
  }
}

// ============================================================
// PUBLIC CONTROLLER — no auth guard
// ============================================================
@ApiTags('Contracts Public')
@Controller('contracts/public')
export class ContractsPublicController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly docuSignService: DocuSignService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'View contract by signatory token (no auth)' })
  async viewByToken(
    @Param('token') token: string,
  ) {
    const { schemaName } = await this.contractsService.findSchemaByContractToken(token);
    return this.contractsService.getByToken(schemaName, token);
  }

  @Post(':token/sign')
  @ApiOperation({ summary: 'Sign a contract by signatory token (no auth)' })
  async sign(
    @Param('token') token: string,
    @Body() body: { signatureData: string },
    @Req() req: any,
  ) {
    const { schemaName } = await this.contractsService.findSchemaByContractToken(token);
    const ip = req.ip || req.headers['x-forwarded-for'] || null;

    // Resolve contract_id from token for the sign() call
    const contract = await this.contractsService.getByToken(schemaName, token);
    return this.contractsService.sign(schemaName, contract.id, token, body.signatureData, ip);
  }

  @Post(':token/decline')
  @ApiOperation({ summary: 'Decline a contract by signatory token (no auth)' })
  async decline(
    @Param('token') token: string,
    @Body() body: { reason?: string },
  ) {
    const { schemaName } = await this.contractsService.findSchemaByContractToken(token);
    return this.contractsService.decline(schemaName, token, body.reason);
  }

  @Post('docusign/webhook')
  @ApiOperation({ summary: 'DocuSign Connect webhook callback (no auth)' })
  async docusignWebhook(@Body() payload: any) {
    // DocuSign Connect sends envelope status updates here.
    // We need to determine the tenant schema from the envelope.
    const envelopeId = payload?.envelopeId || payload?.EnvelopeStatus?.EnvelopeID;
    if (!envelopeId) {
      return { processed: false, reason: 'No envelopeId in payload' };
    }

    // Search all tenant schemas for this envelope
    const tenants = await this.contractsService.findSchemaByEnvelopeId(envelopeId);
    if (!tenants) {
      return { processed: false, reason: 'No contract found for envelope' };
    }

    return this.docuSignService.handleWebhook(tenants.schemaName, payload);
  }
}
