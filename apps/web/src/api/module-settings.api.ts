// ============================================================
// NEW FILE: apps/web/src/api/module-settings.api.ts
// ============================================================
import { api } from './contacts.api';

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

export const moduleSettingsApi = {
  // Field validation
  getFieldValidation: async (module: string): Promise<FieldValidationConfig> => {
    const { data } = await api.get(`/module-settings/${module}/field-validation`);
    return data;
  },
  updateFieldValidation: async (module: string, config: FieldValidationConfig): Promise<FieldValidationConfig> => {
    const { data } = await api.put(`/module-settings/${module}/field-validation`, config);
    return data;
  },
};