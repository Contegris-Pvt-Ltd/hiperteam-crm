import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { WorkflowsService } from './workflows.service';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  // ── LIST ─────────────────────────────────────────────────────
  @Get()
  @RequirePermission('automation', 'view')
  @ApiOperation({ summary: 'List workflows, optionally filtered by module' })
  async list(
    @Request() req: { user: JwtPayload },
    @Query('module') module?: string,
  ) {
    return this.workflowsService.list(req.user.tenantSchema, module);
  }

  // ── GET ONE ──────────────────────────────────────────────────
  @Get(':id')
  @RequirePermission('automation', 'view')
  @ApiOperation({ summary: 'Get workflow with full action list' })
  async getOne(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.workflowsService.getOne(req.user.tenantSchema, id);
  }

  // ── CREATE ───────────────────────────────────────────────────
  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new workflow' })
  async create(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.workflowsService.create(req.user.tenantSchema, body, req.user.sub);
  }

  // ── UPDATE ───────────────────────────────────────────────────
  @Put(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update workflow (replaces action list if provided)' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.workflowsService.update(req.user.tenantSchema, id, body);
  }

  // ── TOGGLE ACTIVE ─────────────────────────────────────────────
  @Patch(':id/toggle')
  @AdminOnly()
  @ApiOperation({ summary: 'Enable or disable a workflow' })
  async toggle(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.workflowsService.toggleActive(req.user.tenantSchema, id, body.isActive);
  }

  // ── DELETE ───────────────────────────────────────────────────
  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a workflow' })
  async delete(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.workflowsService.delete(req.user.tenantSchema, id);
  }

  // ── RUN HISTORY ───────────────────────────────────────────────
  @Get(':id/runs')
  @RequirePermission('automation', 'view')
  @ApiOperation({ summary: 'Get run history for a workflow' })
  async getRuns(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workflowsService.getRuns(
      req.user.tenantSchema, id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
    );
  }

  // ── RUN DETAIL ────────────────────────────────────────────────
  @Get('runs/:runId')
  @RequirePermission('automation', 'view')
  @ApiOperation({ summary: 'Get a single run with step details' })
  async getRunDetail(
    @Request() req: { user: JwtPayload },
    @Param('runId') runId: string,
  ) {
    return this.workflowsService.getRunDetail(req.user.tenantSchema, runId);
  }
}
