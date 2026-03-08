import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { ApprovalService } from './approval.service';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSchema: string;
}

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  // ============================================================
  // APPROVAL QUEUE (logged-in user)
  // ============================================================

  @Get('pending')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get pending approval requests for current user' })
  async getPending(
    @Request() req: { user: JwtPayload },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.approvalService.getPendingForUser(
      req.user.tenantSchema,
      req.user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get latest approval request for an entity' })
  async getEntityRequest(
    @Request() req: { user: JwtPayload },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('triggerEvent') triggerEvent?: string,
  ) {
    return this.approvalService.getEntityRequest(
      req.user.tenantSchema,
      entityType,
      entityId,
      triggerEvent,
    );
  }

  // ── Rule Management (admin only) ── BEFORE :requestId routes ──

  @Get('rules')
  @AdminOnly()
  @ApiOperation({ summary: 'List all approval rules' })
  async getRules(
    @Request() req: { user: JwtPayload },
    @Query('entityType') entityType?: string,
  ) {
    return this.approvalService.getRules(req.user.tenantSchema, entityType);
  }

  @Get('rules/:ruleId')
  @AdminOnly()
  @ApiOperation({ summary: 'Get approval rule by ID' })
  async getRuleById(
    @Request() req: { user: JwtPayload },
    @Param('ruleId') ruleId: string,
  ) {
    return this.approvalService.getRuleById(req.user.tenantSchema, ruleId);
  }

  @Post('rules')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new approval rule' })
  async createRule(
    @Request() req: { user: JwtPayload },
    @Body() body: {
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
  ) {
    return this.approvalService.createRule(req.user.tenantSchema, req.user.sub, body);
  }

  @Put('rules/:ruleId')
  @AdminOnly()
  @ApiOperation({ summary: 'Update an approval rule' })
  async updateRule(
    @Request() req: { user: JwtPayload },
    @Param('ruleId') ruleId: string,
    @Body() body: {
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
  ) {
    return this.approvalService.updateRule(req.user.tenantSchema, ruleId, req.user.sub, body);
  }

  @Delete('rules/:ruleId')
  @AdminOnly()
  @ApiOperation({ summary: 'Soft-delete an approval rule' })
  async deleteRule(
    @Request() req: { user: JwtPayload },
    @Param('ruleId') ruleId: string,
  ) {
    return this.approvalService.deleteRule(req.user.tenantSchema, ruleId, req.user.sub);
  }

  // ── Request endpoints ── AFTER named routes ──

  @Get('requests/:requestId')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get approval request by ID' })
  async getRequest(
    @Request() req: { user: JwtPayload },
    @Param('requestId') requestId: string,
  ) {
    return this.approvalService.getRequest(req.user.tenantSchema, requestId);
  }

  @Post('requests/:requestId/approve')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Approve current step of an approval request' })
  async approve(
    @Request() req: { user: JwtPayload },
    @Param('requestId') requestId: string,
    @Body() body: { comment?: string },
  ) {
    return this.approvalService.approve(
      req.user.tenantSchema,
      requestId,
      req.user.sub,
      body.comment,
    );
  }

  @Post('requests/:requestId/reject')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Reject current step of an approval request' })
  async reject(
    @Request() req: { user: JwtPayload },
    @Param('requestId') requestId: string,
    @Body() body: { comment?: string },
  ) {
    return this.approvalService.reject(
      req.user.tenantSchema,
      requestId,
      req.user.sub,
      body.comment,
    );
  }

  @Post('requests/:requestId/cancel')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Cancel a pending approval request' })
  async cancel(
    @Request() req: { user: JwtPayload },
    @Param('requestId') requestId: string,
  ) {
    return this.approvalService.cancelRequest(
      req.user.tenantSchema,
      requestId,
      req.user.sub,
    );
  }
}
