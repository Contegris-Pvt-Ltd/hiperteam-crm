import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ProfileCompletionConfig {
  id: string;
  module: string;
  fieldWeights: Record<string, { weight: number; label: string; category?: string }>;
  isEnabled: boolean;
  minPercentage: number;
}

export interface ProfileCompletionResult {
  percentage: number;
  filledFields: string[];
  missingFields: { key: string; label: string; weight: number }[];
  totalWeight: number;
  earnedWeight: number;
}

// Standard fields for each module with default weights
const STANDARD_FIELDS: Record<string, Record<string, { weight: number; label: string; category: string }>> = {
  contacts: {
    firstName: { weight: 10, label: 'First Name', category: 'basic' },
    lastName: { weight: 10, label: 'Last Name', category: 'basic' },
    email: { weight: 15, label: 'Email', category: 'contact' },
    phone: { weight: 10, label: 'Phone', category: 'contact' },
    mobile: { weight: 5, label: 'Mobile', category: 'contact' },
    company: { weight: 10, label: 'Company', category: 'basic' },
    jobTitle: { weight: 8, label: 'Job Title', category: 'basic' },
    website: { weight: 3, label: 'Website', category: 'contact' },
    emails: { weight: 5, label: 'Additional Emails', category: 'contact' },
    phones: { weight: 5, label: 'Additional Phones', category: 'contact' },
    addresses: { weight: 7, label: 'Address', category: 'location' },
    socialProfiles: { weight: 5, label: 'Social Profiles', category: 'social' },
    avatarUrl: { weight: 5, label: 'Profile Photo', category: 'basic' },
    source: { weight: 2, label: 'Source', category: 'other' },
  },
  accounts: {
    name: { weight: 15, label: 'Company Name', category: 'basic' },
    website: { weight: 10, label: 'Website', category: 'basic' },
    industry: { weight: 10, label: 'Industry', category: 'basic' },
    companySize: { weight: 8, label: 'Company Size', category: 'basic' },
    annualRevenue: { weight: 5, label: 'Annual Revenue', category: 'basic' },
    description: { weight: 5, label: 'Description', category: 'basic' },
    emails: { weight: 8, label: 'Email Addresses', category: 'contact' },
    phones: { weight: 8, label: 'Phone Numbers', category: 'contact' },
    addresses: { weight: 10, label: 'Address', category: 'location' },
    socialProfiles: { weight: 5, label: 'Social Profiles', category: 'social' },
    logoUrl: { weight: 5, label: 'Company Logo', category: 'basic' },
    accountType: { weight: 6, label: 'Account Type', category: 'other' },
    source: { weight: 5, label: 'Source', category: 'other' },
  },
};

@Injectable()
export class ProfileCompletionService {
  constructor(private dataSource: DataSource) {}

  async getConfig(schemaName: string, module: string): Promise<ProfileCompletionConfig | null> {
    const [config] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".profile_completion_config WHERE module = $1`,
      [module],
    );

    const standardFields = STANDARD_FIELDS[module] || {};

    if (!config) {
      // Return default config if none exists
      return {
        id: '',
        module,
        fieldWeights: standardFields,
        isEnabled: true,
        minPercentage: 0,
      };
    }

    // Merge database config with standard fields (database takes priority)
    const mergedWeights = {
    ...standardFields,
    ...(config.field_weights || {}),
  };

  return {
    id: config.id,
    module: config.module,
    fieldWeights: mergedWeights,
    isEnabled: config.is_enabled,
    minPercentage: config.min_percentage,
  };
}

  async updateConfig(
    schemaName: string,
    module: string,
    fieldWeights: Record<string, { weight: number; label: string }>,
    isEnabled: boolean,
    minPercentage: number,
  ): Promise<ProfileCompletionConfig> {
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".profile_completion_config WHERE module = $1`,
      [module],
    );

    let config;
    if (existing) {
      [config] = await this.dataSource.query(
        `UPDATE "${schemaName}".profile_completion_config 
         SET field_weights = $2, is_enabled = $3, min_percentage = $4, updated_at = NOW()
         WHERE module = $1
         RETURNING *`,
        [module, JSON.stringify(fieldWeights), isEnabled, minPercentage],
      );
    } else {
      [config] = await this.dataSource.query(
        `INSERT INTO "${schemaName}".profile_completion_config 
         (module, field_weights, is_enabled, min_percentage)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [module, JSON.stringify(fieldWeights), isEnabled, minPercentage],
      );
    }

    return {
      id: config.id,
      module: config.module,
      fieldWeights: config.field_weights,
      isEnabled: config.is_enabled,
      minPercentage: config.min_percentage,
    };
  }

  calculateCompletion(
    entity: Record<string, unknown>,
    fieldWeights: Record<string, { weight: number; label: string }>,
    customFields?: { fieldKey: string; completionWeight: number; fieldLabel: string }[],
  ): ProfileCompletionResult {
    const filledFields: string[] = [];
    const missingFields: { key: string; label: string; weight: number }[] = [];
    let totalWeight = 0;
    let earnedWeight = 0;

    // Check standard fields
    for (const [key, config] of Object.entries(fieldWeights)) {
      totalWeight += config.weight;

      if (this.isFieldFilled(entity[key])) {
        filledFields.push(key);
        earnedWeight += config.weight;
      } else {
        missingFields.push({ key, label: config.label, weight: config.weight });
      }
    }

    // Check custom fields
    if (customFields && entity.customFields) {
      const customFieldValues = entity.customFields as Record<string, unknown>;
      for (const field of customFields) {
        if (field.completionWeight > 0) {
          totalWeight += field.completionWeight;

          if (this.isFieldFilled(customFieldValues[field.fieldKey])) {
            filledFields.push(field.fieldKey);
            earnedWeight += field.completionWeight;
          } else {
            missingFields.push({
              key: field.fieldKey,
              label: field.fieldLabel,
              weight: field.completionWeight,
            });
          }
        }
      }
    }

    const percentage = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    // Sort missing fields by weight (highest priority first)
    missingFields.sort((a, b) => b.weight - a.weight);

    return {
      percentage,
      filledFields,
      missingFields,
      totalWeight,
      earnedWeight,
    };
  }

  private isFieldFilled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
      return Object.keys(value).some((k) =>
        this.isFieldFilled((value as Record<string, unknown>)[k]),
      );
    }
    return true;
  }

  getStandardFields(module: string): Record<string, { weight: number; label: string; category: string }> {
    return STANDARD_FIELDS[module] || {};
  }
}