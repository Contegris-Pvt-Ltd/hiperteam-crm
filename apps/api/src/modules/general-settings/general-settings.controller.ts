import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GeneralSettingsService } from './general-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard, AdminOnly } from '../../common/guards/permissions.guard';

@ApiTags('General Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('general-settings')
export class GeneralSettingsController {
  constructor(private readonly settingsService: GeneralSettingsService) {}

  // ── Company Settings ─────────────────────────────────────────────

  @Get('company')
  async getCompanySettings(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getCompanySettings(req.user.tenantSchema);
  }

  @Put('company')
  @AdminOnly()
  async updateCompanySettings(
    @Request() req: { user: JwtPayload },
    @Body() body: any,
  ) {
    return this.settingsService.updateCompanySettings(req.user.tenantSchema, body);
  }

  // ── CURRENCIES ────────────────────────────────────────────────

  @Get('currencies')
  async getCurrencies(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getCurrencies(req.user.tenantSchema);
  }

  @Get('currencies/active')
  async getActiveCurrencies(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getActiveCurrencies(req.user.tenantSchema);
  }

  @Post('currencies')
  @AdminOnly()
  async createCurrency(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createCurrency(req.user.tenantSchema, body);
  }

  @Put('currencies/:id')
  @AdminOnly()
  async updateCurrency(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateCurrency(req.user.tenantSchema, id, body);
  }

  @Post('currencies/:id/set-default')
  @AdminOnly()
  async setDefaultCurrency(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.setDefaultCurrency(req.user.tenantSchema, id);
  }

  @Delete('currencies/:id')
  @AdminOnly()
  async deleteCurrency(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteCurrency(req.user.tenantSchema, id);
  }
}
