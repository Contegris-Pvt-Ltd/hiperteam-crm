// ============================================================
// FILE: apps/api/src/modules/dashboard/dashboard-layout.controller.ts
// ============================================================
import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { DashboardLayoutService } from './dashboard-layout.service';

interface JwtPayload { sub: string; tenantSchema: string; }

@ApiTags('Dashboard Layout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('dashboard/layout')
export class DashboardLayoutController {
  constructor(private readonly svc: DashboardLayoutService) {}

  // ── Dashboards ─────────────────────────────────────────────

  @Get('dashboards')
  @RequirePermission('reports', 'view')
  async list(@Request() req: { user: JwtPayload }) {
    return this.svc.listDashboards(req.user.tenantSchema, req.user.sub);
  }

  @Post('dashboards')
  @RequirePermission('reports', 'create')
  async create(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string },
  ) {
    return this.svc.createDashboard(req.user.tenantSchema, req.user.sub, body.name);
  }

  @Patch('dashboards/:id')
  @RequirePermission('reports', 'edit')
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; isDefault?: boolean; tabFilters?: any },
  ) {
    return this.svc.updateDashboard(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Delete('dashboards/:id')
  @RequirePermission('reports', 'delete')
  async delete(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.svc.deleteDashboard(req.user.tenantSchema, id, req.user.sub);
  }

  // ── Widgets ────────────────────────────────────────────────

  @Get('dashboards/:dashboardId/widgets')
  @RequirePermission('reports', 'view')
  async listWidgets(
    @Request() req: { user: JwtPayload },
    @Param('dashboardId') dashboardId: string,
  ) {
    return this.svc.listWidgets(req.user.tenantSchema, dashboardId);
  }

  @Post('dashboards/:dashboardId/widgets')
  @RequirePermission('reports', 'create')
  async createWidget(
    @Request() req: { user: JwtPayload },
    @Param('dashboardId') dashboardId: string,
    @Body() body: any,
  ) {
    return this.svc.createWidget(req.user.tenantSchema, dashboardId, body, req.user.sub);
  }

  @Put('widgets/:widgetId')
  @RequirePermission('reports', 'edit')
  async updateWidget(
    @Request() req: { user: JwtPayload },
    @Param('widgetId') widgetId: string,
    @Body() body: any,
  ) {
    return this.svc.updateWidget(req.user.tenantSchema, widgetId, body, req.user.sub);
  }

  @Delete('widgets/:widgetId')
  @RequirePermission('reports', 'delete')
  async deleteWidget(
    @Request() req: { user: JwtPayload },
    @Param('widgetId') widgetId: string,
  ) {
    return this.svc.deleteWidget(req.user.tenantSchema, widgetId, req.user.sub);
  }

  @Post('dashboards/:dashboardId/positions')
  @RequirePermission('reports', 'edit')
  async bulkPositions(
    @Request() req: { user: JwtPayload },
    @Param('dashboardId') _dashboardId: string,
    @Body() body: { updates: Array<{ id: string; position: any }> },
  ) {
    return this.svc.bulkUpdatePositions(req.user.tenantSchema, body.updates, req.user.sub);
  }

  @Post('widgets/:widgetId/duplicate')
  @RequirePermission('reports', 'create')
  async duplicate(
    @Request() req: { user: JwtPayload },
    @Param('widgetId') widgetId: string,
    @Body() body: { dashboardId: string },
  ) {
    return this.svc.duplicateWidget(req.user.tenantSchema, widgetId, body.dashboardId, req.user.sub);
  }

  // ── Export / Import ───────────────────────────────────────

  @Get('dashboards/:id/export')
  @RequirePermission('reports', 'export')
  @ApiOperation({ summary: 'Export dashboard as JSON' })
  async exportDashboard(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.svc.exportDashboard(req.user.tenantSchema, id, req.user.sub);
  }

  @Post('dashboards/import')
  @RequirePermission('reports', 'create')
  @ApiOperation({ summary: 'Import dashboard from JSON' })
  async importDashboard(
    @Request() req: { user: JwtPayload },
    @Body() body: any,
  ) {
    return this.svc.importDashboard(req.user.tenantSchema, req.user.sub, body);
  }

  // ── Share Links ───────────────────────────────────────────

  @Post('dashboards/:id/share')
  @RequirePermission('reports', 'edit')
  @ApiOperation({ summary: 'Create a share link for a dashboard' })
  async createShareLink(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { expiresAt?: string; allowedEmails?: string[] },
  ) {
    return this.svc.createShareLink(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Get('dashboards/:id/shares')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'List share links for a dashboard' })
  async listShareLinks(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.svc.listShareLinks(req.user.tenantSchema, id, req.user.sub);
  }

  @Delete('shares/:shareLinkId')
  @RequirePermission('reports', 'edit')
  @ApiOperation({ summary: 'Revoke a share link' })
  async revokeShareLink(
    @Request() req: { user: JwtPayload },
    @Param('shareLinkId') shareLinkId: string,
  ) {
    return this.svc.revokeShareLink(req.user.tenantSchema, shareLinkId, req.user.sub);
  }
}

// ══════════════════════════════════════════════════════════════
// Public controller — no auth required for shared dashboard access
// ══════════════════════════════════════════════════════════════

@ApiTags('Shared Dashboard (Public)')
@Controller('shared/dashboard')
export class SharedDashboardController {
  constructor(private readonly svc: DashboardLayoutService) {}

  @Get(':token')
  @ApiOperation({ summary: 'View a shared dashboard via public token' })
  async getSharedDashboard(
    @Param('token') token: string,
    @Query('email') email?: string,
  ) {
    // We need to find which schema this token belongs to
    // Search across all tenant schemas
    return this.svc.getSharedDashboardPublic(token, email);
  }
}
