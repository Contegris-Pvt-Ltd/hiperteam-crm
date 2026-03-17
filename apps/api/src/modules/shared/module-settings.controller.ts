// ============================================================
// NEW FILE: apps/api/src/modules/shared/module-settings.controller.ts
// ============================================================
import {
  Controller, Get, Put, Param, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AdminOnly } from '../../common/guards/permissions.guard';
import { FieldValidationService, FieldValidationConfig } from './field-validation.service';

@ApiTags('Module Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('module-settings')
export class ModuleSettingsController {
  constructor(
    private fieldValidationService: FieldValidationService,
    private dataSource: DataSource,
  ) {}

  // ============================================================
  // FIELD VALIDATION RULES
  // ============================================================

  @Get(':module/field-validation')
  @ApiOperation({ summary: 'Get field validation rules for a module' })
  async getFieldValidation(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
  ) {
    return this.fieldValidationService.getRules(req.user.tenantSchema, module);
  }

  @Put(':module/field-validation')
  @AdminOnly()
  @ApiOperation({ summary: 'Update field validation rules for a module' })
  async updateFieldValidation(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
    @Body() body: FieldValidationConfig,
  ) {
    return this.fieldValidationService.saveRules(req.user.tenantSchema, module, body);
  }

  // ============================================================
  // FORM FIELD ORDER
  // ============================================================

  @Get(':module/form-field-order')
  @ApiOperation({ summary: 'Get form field order config for a module' })
  async getFormFieldOrder(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
  ) {
    const [row] = await this.dataSource.query(
      `SELECT setting_value FROM "${req.user.tenantSchema}".module_settings
       WHERE module = $1 AND setting_key = 'formFieldOrder'`,
      [module],
    );
    return row?.setting_value || { tabs: {} };
  }

  @Put(':module/form-field-order')
  @AdminOnly()
  @ApiOperation({ summary: 'Update form field order config for a module' })
  async updateFormFieldOrder(
    @Request() req: { user: JwtPayload },
    @Param('module') module: string,
    @Body() body: any,
  ) {
    await this.dataSource.query(
      `INSERT INTO "${req.user.tenantSchema}".module_settings (module, setting_key, setting_value, updated_at)
       VALUES ($1, 'formFieldOrder', $2::jsonb, NOW())
       ON CONFLICT (module, setting_key)
       DO UPDATE SET setting_value = $2::jsonb, updated_at = NOW()`,
      [module, JSON.stringify(body)],
    );
    return body;
  }
}