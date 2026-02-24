// ============================================================
// FILE: apps/api/src/modules/reports/reports.controller.ts
//
// 12 REST endpoints for the Reporting Engine.
// RBAC: reports module (view/create/edit/delete/export)
// ============================================================

import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Res, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import {
  ReportsService,
  CreateReportDto,
  UpdateReportDto,
  QueryReportsDto,
  ExecuteReportDto,
  ScheduleReportDto,
} from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // ============================================================
  // DATA SOURCES (for builder UI)
  // ============================================================

  @Get('data-sources')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'Get available data sources and their fields for report builder' })
  async getDataSources() {
    return this.reportsService.getDataSources();
  }

  // ============================================================
  // REPORT LIBRARY (pre-built system reports)
  // ============================================================

  @Get('library')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'Get pre-built report library grouped by category' })
  async getLibrary(@Request() req: { user: JwtPayload }) {
    return this.reportsService.getLibrary(req.user.tenantSchema);
  }

  // ============================================================
  // FOLDERS
  // ============================================================

  @Get('folders')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'Get report folders' })
  async getFolders(@Request() req: { user: JwtPayload }) {
    return this.reportsService.getFolders(req.user.tenantSchema);
  }

  @Post('folders')
  @RequirePermission('reports', 'create')
  @ApiOperation({ summary: 'Create a report folder' })
  async createFolder(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string; parentId?: string },
  ) {
    return this.reportsService.createFolder(req.user.tenantSchema, body.name, body.parentId, req.user.sub);
  }

  @Delete('folders/:id')
  @RequirePermission('reports', 'delete')
  @ApiOperation({ summary: 'Delete a report folder' })
  async deleteFolder(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.reportsService.deleteFolder(req.user.tenantSchema, id);
  }

  // ============================================================
  // EXECUTE (preview — run a config without saving)
  // ============================================================

  @Post('execute')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'Execute a report definition (preview / unsaved)' })
  async executePreview(
    @Request() req: { user: JwtPayload },
    @Body() dto: ExecuteReportDto,
  ) {
    return this.reportsService.executeConfig(req.user.tenantSchema, dto, req.user);
  }

  // ============================================================
  // REPORTS CRUD
  // ============================================================

  @Get()
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'List saved reports' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.findAll(req.user.tenantSchema, query, req.user);
  }

  @Get(':id')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'Get report definition' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.reportsService.findOne(req.user.tenantSchema, id, req.user);
  }

  @Post()
  @RequirePermission('reports', 'create')
  @ApiOperation({ summary: 'Create a custom report' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Put(':id')
  @RequirePermission('reports', 'edit')
  @ApiOperation({ summary: 'Update a report' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.update(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id')
  @RequirePermission('reports', 'delete')
  @ApiOperation({ summary: 'Delete a report' })
  async delete(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.reportsService.delete(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // CLONE
  // ============================================================

  @Post(':id/clone')
  @RequirePermission('reports', 'create')
  @ApiOperation({ summary: 'Clone a report' })
  async clone(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    return this.reportsService.clone(req.user.tenantSchema, id, req.user.sub, body?.name);
  }

  // ============================================================
  // EXECUTE SAVED REPORT
  // ============================================================

  @Get(':id/execute')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'Execute a saved report' })
  async executeSaved(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('filters') filtersJson?: string,
  ) {
    let runtimeFilters;
    if (filtersJson) {
      try {
        runtimeFilters = JSON.parse(filtersJson);
      } catch {
        // ignore invalid filter JSON
      }
    }
    return this.reportsService.execute(req.user.tenantSchema, id, req.user, runtimeFilters);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  @Post(':id/export')
  @RequirePermission('reports', 'export')
  @ApiOperation({ summary: 'Export report to CSV/Excel' })
  async exportReport(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { format?: 'csv' | 'xlsx' },
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportReport(
      req.user.tenantSchema, id, req.user, body?.format || 'csv',
    );

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  // ============================================================
  // SCHEDULES
  // ============================================================

  @Get(':id/schedules')
  @RequirePermission('reports', 'view')
  @ApiOperation({ summary: 'Get schedules for a report' })
  async getSchedules(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.reportsService.getSchedules(req.user.tenantSchema, id);
  }

  @Post(':id/schedule')
  @RequirePermission('reports', 'edit')
  @ApiOperation({ summary: 'Create or update a report schedule' })
  async upsertSchedule(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ScheduleReportDto,
  ) {
    return this.reportsService.upsertSchedule(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id/schedule')
  @RequirePermission('reports', 'delete')
  @ApiOperation({ summary: 'Delete report schedule' })
  async deleteSchedule(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.reportsService.deleteSchedule(req.user.tenantSchema, id);
  }
}