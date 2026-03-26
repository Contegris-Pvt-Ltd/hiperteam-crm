import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Request, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { GeneralSettingsService } from './general-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard, AdminOnly, RequirePermission } from '../../common/guards/permissions.guard';

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

  // ── Account Status Settings ──────────────────────────────────

  @Get('account-statuses')
  @RequirePermission('settings', 'view')
  async getAccountStatuses(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getAccountStatuses(req.user.tenantSchema);
  }

  @Put('account-statuses')
  @AdminOnly()
  async updateAccountStatuses(
    @Request() req: { user: JwtPayload },
    @Body() body: any[],
  ) {
    return this.settingsService.updateAccountStatuses(req.user.tenantSchema, body);
  }

  // ── Contact Type Settings ──────────────────────────────────

  @Get('contact-type-settings')
  @RequirePermission('settings', 'view')
  async getContactTypeSettings(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getContactTypeSettings(req.user.tenantSchema);
  }

  @Put('contact-type-settings')
  @AdminOnly()
  async updateContactTypeSettings(
    @Request() req: { user: JwtPayload },
    @Body() body: any,
  ) {
    return this.settingsService.updateContactTypeSettings(req.user.tenantSchema, body);
  }

  // ── DATA EXPORT ──────────────────────────────────────────────

  @Get('export-data')
  @AdminOnly()
  async exportAllData(
    @Request() req: { user: JwtPayload },
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.settingsService.exportAllData(
      req.user.tenantSchema,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  // ── DATA PURGE ──────────────────────────────────────────────

  @Post('purge-data')
  @AdminOnly()
  async purgeAllData(
    @Request() req: { user: JwtPayload },
    @Body() body: { confirmationPhrase: string },
  ) {
    return this.settingsService.purgeAllData(
      req.user.tenantSchema,
      req.user.sub,
      body.confirmationPhrase,
    );
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
