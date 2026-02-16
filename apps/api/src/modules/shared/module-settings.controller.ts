// ============================================================
// NEW FILE: apps/api/src/modules/shared/module-settings.controller.ts
// ============================================================
import {
  Controller, Get, Put, Param, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
}