export interface ProfileCompletionConfig {
  field: string;
  weight: number;
  label: string;
  category: 'basic' | 'contact' | 'address' | 'social' | 'business';
}

export const CONTACT_PROFILE_FIELDS: ProfileCompletionConfig[] = [
  // Basic Info (30%)
  { field: 'firstName', weight: 5, label: 'First Name', category: 'basic' },
  { field: 'lastName', weight: 5, label: 'Last Name', category: 'basic' },
  { field: 'email', weight: 10, label: 'Email', category: 'basic' },
  { field: 'phone', weight: 5, label: 'Phone', category: 'basic' },
  { field: 'mobile', weight: 5, label: 'Mobile', category: 'basic' },

  // Business Info (30%)
  { field: 'company', weight: 10, label: 'Company', category: 'business' },
  { field: 'jobTitle', weight: 10, label: 'Job Title', category: 'business' },
  { field: 'website', weight: 5, label: 'Website', category: 'business' },
  { field: 'source', weight: 5, label: 'Source', category: 'business' },

  // Address (25%)
  { field: 'addressLine1', weight: 5, label: 'Address', category: 'address' },
  { field: 'city', weight: 5, label: 'City', category: 'address' },
  { field: 'state', weight: 5, label: 'State', category: 'address' },
  { field: 'country', weight: 5, label: 'Country', category: 'address' },
  { field: 'postalCode', weight: 5, label: 'Postal Code', category: 'address' },

  // Social (15%)
  { field: 'socialProfiles.linkedin', weight: 8, label: 'LinkedIn', category: 'social' },
  { field: 'socialProfiles.twitter', weight: 4, label: 'Twitter', category: 'social' },
  { field: 'socialProfiles.facebook', weight: 3, label: 'Facebook', category: 'social' },
];

export function calculateProfileCompletion(contact: Record<string, unknown>): {
  percentage: number;
  missingFields: { field: string; label: string; weight: number }[];
  completedFields: { field: string; label: string; weight: number }[];
  categoryBreakdown: Record<string, { completed: number; total: number; percentage: number }>;
} {
  const missingFields: { field: string; label: string; weight: number }[] = [];
  const completedFields: { field: string; label: string; weight: number }[] = [];
  const categoryBreakdown: Record<string, { completed: number; total: number; percentage: number }> = {
    basic: { completed: 0, total: 0, percentage: 0 },
    contact: { completed: 0, total: 0, percentage: 0 },
    address: { completed: 0, total: 0, percentage: 0 },
    social: { completed: 0, total: 0, percentage: 0 },
    business: { completed: 0, total: 0, percentage: 0 },
  };

  let totalWeight = 0;
  let completedWeight = 0;

  for (const config of CONTACT_PROFILE_FIELDS) {
    totalWeight += config.weight;
    categoryBreakdown[config.category].total += config.weight;

    const value = getNestedValue(contact, config.field);
    const isCompleted = hasValue(value);

    if (isCompleted) {
      completedWeight += config.weight;
      completedFields.push({ field: config.field, label: config.label, weight: config.weight });
      categoryBreakdown[config.category].completed += config.weight;
    } else {
      missingFields.push({ field: config.field, label: config.label, weight: config.weight });
    }
  }

  // Calculate category percentages
  for (const category of Object.keys(categoryBreakdown)) {
    const cat = categoryBreakdown[category];
    cat.percentage = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
  }

  const percentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  return {
    percentage,
    missingFields,
    completedFields,
    categoryBreakdown,
  };
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}