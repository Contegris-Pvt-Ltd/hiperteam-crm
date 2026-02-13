// ============================================================
// FILE: apps/api/src/modules/shared/table-preferences.controller.ts
// ============================================================
import {
  Controller, Get, Put, Delete,
  Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TablePreferencesService } from './table-preferences.service';
import { TableColumnsService } from './table-columns.service';

@ApiTags('Table Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TablePreferencesController {
  constructor(
    private prefsService: TablePreferencesService,
    private columnsService: TableColumnsService,
  ) {}

  // ── GET /table-columns/:module — all available columns for a module ──
  @Get('table-columns/:module')
  @ApiOperation({ summary: 'Get all available table columns for a module (system + custom + computed)' })
  async getColumns(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
  ) {
    return this.columnsService.getColumns(req.user.tenantSchema, module);
  }

  // ── GET /table-preferences/:module — user's saved preferences ──
  @Get('table-preferences/:module')
  @ApiOperation({ summary: 'Get user table preferences for a module' })
  async getPreferences(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
  ) {
    return this.prefsService.get(req.user.tenantSchema, req.user.sub, module);
  }

  // ── PUT /table-preferences/:module — save preferences ──
  @Put('table-preferences/:module')
  @ApiOperation({ summary: 'Save user table preferences for a module' })
  async savePreferences(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
    @Body() body: {
      visibleColumns?: string[];
      columnWidths?: Record<string, number>;
      pageSize?: number;
      defaultSortColumn?: string;
      defaultSortOrder?: 'ASC' | 'DESC';
    },
  ) {
    return this.prefsService.save(req.user.tenantSchema, req.user.sub, module, {
      ...body,
      module,
    });
  }

  // ── DELETE /table-preferences/:module — reset to defaults ──
  @Delete('table-preferences/:module')
  @ApiOperation({ summary: 'Reset table preferences to defaults' })
  async resetPreferences(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
  ) {
    await this.prefsService.reset(req.user.tenantSchema, req.user.sub, module);
    return { message: 'Preferences reset to defaults' };
  }
}