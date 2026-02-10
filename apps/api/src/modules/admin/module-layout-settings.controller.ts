/**
 * MODULE LAYOUT SETTINGS CONTROLLER
 */

import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuleLayoutSettingsService } from './module-layout-settings.service';

@Controller('admin/module-layout-settings')
@UseGuards(JwtAuthGuard)
export class ModuleLayoutSettingsController {
  constructor(private readonly settingsService: ModuleLayoutSettingsService) {}

  /**
   * Get all settings for admin view
   */
  @Get()
  async getAllSettings(@Request() req: any) {
    const settings = await this.settingsService.getAllSettings(req.user.tenantSchema);
    return { data: settings };
  }

  /**
   * Get setting for specific module/view
   * This endpoint is used by all users to check which layout to render
   */
  @Get('check')
  async checkSetting(
    @Request() req: any,
    @Query('module') module: string,
    @Query('layoutType') layoutType: string,
  ) {
    return this.settingsService.getActiveLayoutConfig(
      req.user.tenantSchema,
      module,
      layoutType,
    );
  }

  /**
   * Get available layouts for dropdown
   */
  @Get('available-layouts')
  async getAvailableLayouts(
    @Request() req: any,
    @Query('module') module: string,
    @Query('layoutType') layoutType: string,
  ) {
    const layouts = await this.settingsService.getAvailableLayouts(
      req.user.tenantSchema,
      module,
      layoutType,
    );
    return { data: layouts };
  }

  /**
   * Update setting for a module/view
   */
  @Put()
  async updateSetting(
    @Request() req: any,
    @Body() body: {
      module: string;
      layoutType: string;
      useCustomLayout: boolean;
      layoutId?: string;
    },
  ) {
    const setting = await this.settingsService.updateSetting(
      req.user.tenantSchema,
      body.module,
      body.layoutType,
      body.useCustomLayout,
      body.layoutId || null,
    );
    return { data: setting };
  }
}