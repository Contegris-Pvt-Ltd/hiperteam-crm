// ============================================================
// NEW FILE: apps/api/src/modules/shared/field-validation.service.ts
// ============================================================
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ValidationRule {
  id: string;
  fields: string[];
  type: 'required' | 'any_one' | 'all';
  label: string;
  message: string;
  isActive: boolean;
}

export interface FieldValidationConfig {
  rules: ValidationRule[];
}

@Injectable()
export class FieldValidationService {
  private readonly logger = new Logger(FieldValidationService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get field validation rules for a module
   */
  async getRules(schemaName: string, module: string): Promise<FieldValidationConfig> {
    const [row] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".module_settings
       WHERE module = $1 AND setting_key = 'fieldValidation'`,
      [module],
    );
    if (!row) {
      return { rules: [] };
    }
    return row.setting_value as FieldValidationConfig;
  }

  /**
   * Save field validation rules for a module
   */
  async saveRules(schemaName: string, module: string, config: FieldValidationConfig): Promise<FieldValidationConfig> {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".module_settings (module, setting_key, setting_value, updated_at)
       VALUES ($1, 'fieldValidation', $2::jsonb, NOW())
       ON CONFLICT (module, setting_key) 
       DO UPDATE SET setting_value = $2::jsonb, updated_at = NOW()`,
      [module, JSON.stringify(config)],
    );
    return config;
  }

  /**
   * Validate data against the module's field validation rules.
   * Call this from each module's create() and update() methods.
   * 
   * @param schemaName - tenant schema
   * @param module - 'leads' | 'contacts' | 'accounts' | 'opportunities'
   * @param data - flat key-value object of the record being created/updated
   * @param customFields - optional custom field values (from data.customFields)
   * @throws BadRequestException with structured error details
   */
  async validate(
    schemaName: string,
    module: string,
    data: Record<string, any>,
    customFields?: Record<string, any>,
  ): Promise<void> {
    const config = await this.getRules(schemaName, module);
    if (!config.rules || config.rules.length === 0) return;

    const errors: { rule: string; message: string; fields: string[] }[] = [];

    for (const rule of config.rules) {
      if (!rule.isActive) continue;

      const values = rule.fields.map(fieldKey => {
        // Check main data first, then customFields
        let val = data[fieldKey];
        if ((val === undefined || val === null || val === '') && customFields) {
          val = customFields[fieldKey];
        }
        return val;
      });

      switch (rule.type) {
        case 'required': {
          // Single field must be filled (first field in array)
          const val = values[0];
          if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
            errors.push({
              rule: rule.id,
              message: rule.message || `${rule.label} is required`,
              fields: rule.fields,
            });
          }
          break;
        }
        case 'any_one': {
          // At least ONE of the listed fields must have a value
          const hasAny = values.some(v =>
            v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== ''),
          );
          if (!hasAny) {
            errors.push({
              rule: rule.id,
              message: rule.message || `At least one of ${rule.label} is required`,
              fields: rule.fields,
            });
          }
          break;
        }
        case 'all': {
          // ALL listed fields must be filled
          const missingFields: string[] = [];
          values.forEach((v, i) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
              missingFields.push(rule.fields[i]);
            }
          });
          if (missingFields.length > 0) {
            errors.push({
              rule: rule.id,
              message: rule.message || `All of ${rule.label} are required`,
              fields: missingFields,
            });
          }
          break;
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: errors.map(e => e.message).join('. '),
        validationErrors: errors,
      });
    }
  }
}