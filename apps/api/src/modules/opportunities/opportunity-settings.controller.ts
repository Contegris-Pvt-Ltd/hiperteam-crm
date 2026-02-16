// ============================================================
// FILE: apps/api/src/modules/opportunities/opportunity-settings.controller.ts
//
// REST endpoints for opportunity admin settings:
//   GET/POST/PUT/DELETE /api/opportunity-settings/priorities
//   GET/POST/PUT/DELETE /api/opportunity-settings/close-reasons
//   GET/POST/PUT/DELETE /api/opportunity-settings/types
//   GET/POST/PUT/DELETE /api/opportunity-settings/forecast-categories
//
// Follows lead-settings.controller.ts patterns
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Request, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { OpportunitySettingsService } from './opportunity-settings.service';

@ApiTags('Opportunity Settings')
@ApiBearerAuth()
@Controller('opportunity-settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OpportunitySettingsController {
  constructor(private readonly settingsService: OpportunitySettingsService) {}

  // ============================================================
  // PRIORITIES
  // ============================================================
  @Get('priorities')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get opportunity priorities' })
  async getPriorities(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getPriorities(req.user.tenantSchema);
  }

  @Post('priorities')
  @AdminOnly()
  @ApiOperation({ summary: 'Create priority' })
  async createPriority(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createPriority(req.user.tenantSchema, body);
  }

  @Put('priorities/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update priority' })
  async updatePriority(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updatePriority(req.user.tenantSchema, id, body);
  }

  @Delete('priorities/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete priority' })
  async deletePriority(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deletePriority(req.user.tenantSchema, id);
  }

  // ============================================================
  // CLOSE REASONS (won / lost)
  // ============================================================
  @Get('close-reasons')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get close reasons' })
  @ApiQuery({ name: 'type', required: false, enum: ['won', 'lost'] })
  async getCloseReasons(
    @Request() req: { user: JwtPayload },
    @Query('type') type?: string,
  ) {
    return this.settingsService.getCloseReasons(req.user.tenantSchema, type);
  }

  @Post('close-reasons')
  @AdminOnly()
  @ApiOperation({ summary: 'Create close reason' })
  async createCloseReason(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createCloseReason(req.user.tenantSchema, body);
  }

  @Put('close-reasons/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update close reason' })
  async updateCloseReason(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateCloseReason(req.user.tenantSchema, id, body);
  }

  @Delete('close-reasons/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete close reason' })
  async deleteCloseReason(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteCloseReason(req.user.tenantSchema, id);
  }

  // ============================================================
  // TYPES
  // ============================================================
  @Get('types')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get opportunity types (active only)' })
  async getTypes(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getTypes(req.user.tenantSchema);
  }

  @Get('types/all')
  @AdminOnly()
  @ApiOperation({ summary: 'Get all opportunity types (including inactive)' })
  async getAllTypes(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getAllTypes(req.user.tenantSchema);
  }

  @Post('types')
  @AdminOnly()
  @ApiOperation({ summary: 'Create opportunity type' })
  async createType(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createType(req.user.tenantSchema, body);
  }

  @Put('types/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update opportunity type' })
  async updateType(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateType(req.user.tenantSchema, id, body);
  }

  @Delete('types/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete opportunity type' })
  async deleteType(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteType(req.user.tenantSchema, id);
  }

  // ============================================================
  // FORECAST CATEGORIES
  // ============================================================
  @Get('forecast-categories')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get forecast categories (active only)' })
  async getForecastCategories(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getForecastCategories(req.user.tenantSchema);
  }

  @Get('forecast-categories/all')
  @AdminOnly()
  @ApiOperation({ summary: 'Get all forecast categories (including inactive)' })
  async getAllForecastCategories(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getAllForecastCategories(req.user.tenantSchema);
  }

  @Post('forecast-categories')
  @AdminOnly()
  @ApiOperation({ summary: 'Create forecast category' })
  async createForecastCategory(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createForecastCategory(req.user.tenantSchema, body);
  }

  @Put('forecast-categories/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update forecast category' })
  async updateForecastCategory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateForecastCategory(req.user.tenantSchema, id, body);
  }

  @Delete('forecast-categories/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete forecast category' })
  async deleteForecastCategory(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteForecastCategory(req.user.tenantSchema, id);
  }
}