import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ProfileCompletionConfig {
  id: string;
  module: string;
  fieldWeights: Record<string, { weight: number; label: string; category?: string; classificationFilter?: string }>;
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
const STANDARD_FIELDS: Record<string, Record<string, { weight: number; label: string; category: string; classificationFilter?: string }>> = {
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
    // Common fields (both B2B and B2C)
    name: { weight: 15, label: 'Account Name', category: 'basic' },
    website: { weight: 5, label: 'Website', category: 'basic' },
    description: { weight: 5, label: 'Description', category: 'basic' },
    emails: { weight: 8, label: 'Email Addresses', category: 'contact' },
    phones: { weight: 8, label: 'Phone Numbers', category: 'contact' },
    addresses: { weight: 10, label: 'Address', category: 'location' },
    socialProfiles: { weight: 5, label: 'Social Profiles', category: 'social' },
    logoUrl: { weight: 5, label: 'Logo / Photo', category: 'basic' },
    accountType: { weight: 6, label: 'Account Type', category: 'other' },
    source: { weight: 5, label: 'Source', category: 'other' },
    // B2B fields — only counted when accountClassification = 'business'
    industry: { weight: 10, label: 'Industry', category: 'basic', classificationFilter: 'business' },
    companySize: { weight: 8, label: 'Company Size', category: 'basic', classificationFilter: 'business' },
    annualRevenue: { weight: 5, label: 'Annual Revenue', category: 'basic', classificationFilter: 'business' },
    // B2C fields — only counted when accountClassification = 'individual'
    firstName: { weight: 12, label: 'First Name', category: 'basic', classificationFilter: 'individual' },
    lastName: { weight: 10, label: 'Last Name', category: 'basic', classificationFilter: 'individual' },
    dateOfBirth: { weight: 6, label: 'Date of Birth', category: 'basic', classificationFilter: 'individual' },
    gender: { weight: 4, label: 'Gender', category: 'basic', classificationFilter: 'individual' },
    nationalId: { weight: 5, label: 'National ID', category: 'basic', classificationFilter: 'individual' },
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
    record: Record<string, unknown>,
    fieldWeights: Record<string, { weight: number; label: string; category?: string; classificationFilter?: string }>,
    customFieldConfigs: { fieldKey: string; completionWeight: number; fieldLabel: string }[] = [],
  ) {
    let totalWeight = 0;
    let earnedWeight = 0;
    const filledFields: string[] = [];
    const missingFields: { key: string; label: string; weight: number }[] = [];

    // Get account classification for filtering (only relevant for accounts module)
    const classification = record.accountClassification as string | undefined;

    for (const [key, config] of Object.entries(fieldWeights)) {
      // Skip fields that don't match the current classification
      if (config.classificationFilter) {
        if (classification && config.classificationFilter !== classification) {
          continue; // Skip this field — doesn't apply to current classification
        }
      }

      totalWeight += config.weight;
      const value = record[key];
      const isFilled = this.isFieldFilled(value);
      if (isFilled) {
        earnedWeight += config.weight;
        filledFields.push(key);
      } else {
        missingFields.push({ key, label: config.label, weight: config.weight });
      }
    }

    // Custom fields (same as before — no classification filter)
    for (const cf of customFieldConfigs) {
      totalWeight += cf.completionWeight;
      const customValues = (record.customFields || {}) as Record<string, unknown>;
      const isFilled = this.isFieldFilled(customValues[cf.fieldKey]);
      if (isFilled) {
        earnedWeight += cf.completionWeight;
        filledFields.push(cf.fieldKey);
      } else {
        missingFields.push({ key: cf.fieldKey, label: cf.fieldLabel, weight: cf.completionWeight });
      }
    }

    return {
      percentage: totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0,
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