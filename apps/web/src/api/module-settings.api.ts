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
  appliesTo?: 'business' | 'individual'; // Accounts only: restrict rule to a classification (omit = all)
}

export interface FieldValidationConfig {
  rules: ValidationRule[];
}

export interface FormFieldOrderTab {
  label: string;
  fields: { key: string; visible: boolean }[];
}

export interface FormFieldOrderConfig {
  tabs: Record<string, FormFieldOrderTab>;
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

  // Form field order
  getFormFieldOrder: async (module: string): Promise<FormFieldOrderConfig> => {
    const { data } = await api.get(`/module-settings/${module}/form-field-order`);
    return data;
  },
  updateFormFieldOrder: async (module: string, config: FormFieldOrderConfig): Promise<FormFieldOrderConfig> => {
    const { data } = await api.put(`/module-settings/${module}/form-field-order`, config);
    return data;
  },
};