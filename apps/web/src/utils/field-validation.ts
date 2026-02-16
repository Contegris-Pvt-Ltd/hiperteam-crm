// ============================================================
// NEW FILE: apps/web/src/utils/field-validation.ts
// ============================================================
// Shared utility for client-side field validation.
// Used by LeadEditPage, ContactEditPage, AccountEditPage, etc.
// ============================================================
import type { FieldValidationConfig } from '../api/module-settings.api';

export interface ValidationError {
  rule: string;       // rule.id
  message: string;
  fields: string[];   // which fields failed
}

/**
 * Validate form data against field validation rules.
 * Returns an array of errors (empty = valid).
 *
 * @param config - field validation config from moduleSettingsApi
 * @param data   - flat object of field values (e.g. formData)
 * @param customFields - optional separate custom fields object
 */
export function validateFields(
  config: FieldValidationConfig,
  data: Record<string, any>,
  customFields?: Record<string, any>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!config.rules) return errors;

  for (const rule of config.rules) {
    if (!rule.isActive) continue;

    const values = rule.fields.map(fieldKey => {
      let val = data[fieldKey];
      if ((val === undefined || val === null || val === '') && customFields) {
        val = customFields[fieldKey];
      }
      return val;
    });

    switch (rule.type) {
      case 'required': {
        const val = values[0];
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          errors.push({
            rule: rule.id,
            message: rule.message || `${rule.label || rule.fields[0]} is required`,
            fields: rule.fields,
          });
        }
        break;
      }
      case 'any_one': {
        const hasAny = values.some(v =>
          v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== ''),
        );
        if (!hasAny) {
          errors.push({
            rule: rule.id,
            message: rule.message || `At least one of ${rule.label || rule.fields.join(', ')} is required`,
            fields: rule.fields,
          });
        }
        break;
      }
      case 'all': {
        const missingFields: string[] = [];
        values.forEach((v, i) => {
          if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
            missingFields.push(rule.fields[i]);
          }
        });
        if (missingFields.length > 0) {
          errors.push({
            rule: rule.id,
            message: rule.message || `All of ${rule.label || rule.fields.join(', ')} are required`,
            fields: missingFields,
          });
        }
        break;
      }
    }
  }

  return errors;
}

/**
 * Convert validation errors into a field-keyed error map for form display.
 * Fields that appear in any failed rule will have an error message.
 */
export function errorsToFieldMap(errors: ValidationError[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const err of errors) {
    for (const field of err.fields) {
      if (!map[field]) {
        map[field] = err.message;
      }
    }
  }
  return map;
}