/**
 * UNIFIED FIELD REGISTRY
 * 
 * This module defines all system fields for each module (contacts, accounts, etc.)
 * in a format compatible with CustomField, so they can be rendered alongside
 * custom fields by the same components.
 * 
 * The Page Designer and DynamicPageRenderer use this registry to:
 * 1. Know which system fields exist in each section
 * 2. Render them using a unified FieldRenderer
 * 3. Allow drag-drop reordering of all fields (system + custom)
 */

import type { CustomField } from '../api/admin.api';

// ==================== SYSTEM FIELD DEFINITION ====================

export interface SystemFieldDefinition {
  id: string; // system-{fieldKey}
  fieldKey: string;
  fieldLabel: string;
  fieldType: CustomField['fieldType'];
  section: string;
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
  columnSpan: 1 | 2;
  displayOrder: number;
  // System field specific
  isSystem: true;
  isEditable: boolean; // Can the field be edited? (e.g., createdAt is not editable)
  component?: 'default' | 'avatar' | 'account-link' | 'tags' | 'rich-text'; // Special rendering
  validationRules?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

// ==================== CONTACTS MODULE ====================

export const CONTACTS_SYSTEM_FIELDS: SystemFieldDefinition[] = [
  // Basic Info Section
  {
    id: 'system-firstName',
    fieldKey: 'firstName',
    fieldLabel: 'First Name',
    fieldType: 'text',
    section: 'basic',
    isRequired: true,
    placeholder: 'Enter first name',
    columnSpan: 1,
    displayOrder: 1,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-lastName',
    fieldKey: 'lastName',
    fieldLabel: 'Last Name',
    fieldType: 'text',
    section: 'basic',
    isRequired: true,
    placeholder: 'Enter last name',
    columnSpan: 1,
    displayOrder: 2,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-jobTitle',
    fieldKey: 'jobTitle',
    fieldLabel: 'Job Title',
    fieldType: 'text',
    section: 'basic',
    isRequired: false,
    placeholder: 'e.g., Marketing Manager',
    columnSpan: 1,
    displayOrder: 3,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-department',
    fieldKey: 'department',
    fieldLabel: 'Department',
    fieldType: 'text',
    section: 'basic',
    isRequired: false,
    placeholder: 'e.g., Marketing',
    columnSpan: 1,
    displayOrder: 4,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-accountId',
    fieldKey: 'accountId',
    fieldLabel: 'Company',
    fieldType: 'text', // Actually rendered as account-link
    section: 'basic',
    isRequired: false,
    columnSpan: 2,
    displayOrder: 5,
    isSystem: true,
    isEditable: true,
    component: 'account-link',
  },
  
  // Contact Details Section
  {
    id: 'system-email',
    fieldKey: 'email',
    fieldLabel: 'Email',
    fieldType: 'email',
    section: 'contact',
    isRequired: false,
    placeholder: 'email@example.com',
    columnSpan: 1,
    displayOrder: 10,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-phone',
    fieldKey: 'phone',
    fieldLabel: 'Phone',
    fieldType: 'phone',
    section: 'contact',
    isRequired: false,
    placeholder: '+1 (555) 000-0000',
    columnSpan: 1,
    displayOrder: 11,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-mobile',
    fieldKey: 'mobile',
    fieldLabel: 'Mobile',
    fieldType: 'phone',
    section: 'contact',
    isRequired: false,
    placeholder: '+1 (555) 000-0000',
    columnSpan: 1,
    displayOrder: 12,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-fax',
    fieldKey: 'fax',
    fieldLabel: 'Fax',
    fieldType: 'phone',
    section: 'contact',
    isRequired: false,
    placeholder: '+1 (555) 000-0000',
    columnSpan: 1,
    displayOrder: 13,
    isSystem: true,
    isEditable: true,
  },
  
  // Address Section
  {
    id: 'system-mailingStreet',
    fieldKey: 'mailingStreet',
    fieldLabel: 'Street',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: '123 Main Street',
    columnSpan: 2,
    displayOrder: 20,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-mailingCity',
    fieldKey: 'mailingCity',
    fieldLabel: 'City',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'City',
    columnSpan: 1,
    displayOrder: 21,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-mailingState',
    fieldKey: 'mailingState',
    fieldLabel: 'State/Province',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'State',
    columnSpan: 1,
    displayOrder: 22,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-mailingPostalCode',
    fieldKey: 'mailingPostalCode',
    fieldLabel: 'Postal Code',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: '12345',
    columnSpan: 1,
    displayOrder: 23,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-mailingCountry',
    fieldKey: 'mailingCountry',
    fieldLabel: 'Country',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'Country',
    columnSpan: 1,
    displayOrder: 24,
    isSystem: true,
    isEditable: true,
  },
  
  // Social Profiles Section
  {
    id: 'system-linkedIn',
    fieldKey: 'linkedIn',
    fieldLabel: 'LinkedIn',
    fieldType: 'url',
    section: 'social',
    isRequired: false,
    placeholder: 'https://linkedin.com/in/username',
    columnSpan: 1,
    displayOrder: 30,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-twitter',
    fieldKey: 'twitter',
    fieldLabel: 'Twitter/X',
    fieldType: 'url',
    section: 'social',
    isRequired: false,
    placeholder: 'https://twitter.com/username',
    columnSpan: 1,
    displayOrder: 31,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-facebook',
    fieldKey: 'facebook',
    fieldLabel: 'Facebook',
    fieldType: 'url',
    section: 'social',
    isRequired: false,
    placeholder: 'https://facebook.com/username',
    columnSpan: 1,
    displayOrder: 32,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-website',
    fieldKey: 'website',
    fieldLabel: 'Website',
    fieldType: 'url',
    section: 'social',
    isRequired: false,
    placeholder: 'https://example.com',
    columnSpan: 1,
    displayOrder: 33,
    isSystem: true,
    isEditable: true,
  },
  
  // Other Section
  {
    id: 'system-description',
    fieldKey: 'description',
    fieldLabel: 'Description',
    fieldType: 'textarea',
    section: 'other',
    isRequired: false,
    placeholder: 'Additional notes...',
    columnSpan: 2,
    displayOrder: 40,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-source',
    fieldKey: 'source',
    fieldLabel: 'Lead Source',
    fieldType: 'select',
    section: 'other',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 41,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-tags',
    fieldKey: 'tags',
    fieldLabel: 'Tags',
    fieldType: 'multi_select',
    section: 'other',
    isRequired: false,
    columnSpan: 2,
    displayOrder: 42,
    isSystem: true,
    isEditable: true,
    component: 'tags',
  },
];

// ==================== ACCOUNTS MODULE ====================

export const ACCOUNTS_SYSTEM_FIELDS: SystemFieldDefinition[] = [
  // Basic Info Section
  {
    id: 'system-name',
    fieldKey: 'name',
    fieldLabel: 'Account Name',
    fieldType: 'text',
    section: 'basic',
    isRequired: true,
    placeholder: 'Enter company name',
    columnSpan: 2,
    displayOrder: 1,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-industry',
    fieldKey: 'industry',
    fieldLabel: 'Industry',
    fieldType: 'select',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 2,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-type',
    fieldKey: 'type',
    fieldLabel: 'Type',
    fieldType: 'select',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 3,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-employeeCount',
    fieldKey: 'employeeCount',
    fieldLabel: 'Employees',
    fieldType: 'number',
    section: 'basic',
    isRequired: false,
    placeholder: 'Number of employees',
    columnSpan: 1,
    displayOrder: 4,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-annualRevenue',
    fieldKey: 'annualRevenue',
    fieldLabel: 'Annual Revenue',
    fieldType: 'number',
    section: 'basic',
    isRequired: false,
    placeholder: 'Annual revenue',
    columnSpan: 1,
    displayOrder: 5,
    isSystem: true,
    isEditable: true,
  },
  
  // Contact Details Section
  {
    id: 'system-phone',
    fieldKey: 'phone',
    fieldLabel: 'Phone',
    fieldType: 'phone',
    section: 'contact',
    isRequired: false,
    placeholder: '+1 (555) 000-0000',
    columnSpan: 1,
    displayOrder: 10,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-fax',
    fieldKey: 'fax',
    fieldLabel: 'Fax',
    fieldType: 'phone',
    section: 'contact',
    isRequired: false,
    placeholder: '+1 (555) 000-0000',
    columnSpan: 1,
    displayOrder: 11,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-website',
    fieldKey: 'website',
    fieldLabel: 'Website',
    fieldType: 'url',
    section: 'contact',
    isRequired: false,
    placeholder: 'https://example.com',
    columnSpan: 2,
    displayOrder: 12,
    isSystem: true,
    isEditable: true,
  },
  
  // Address Section
  {
    id: 'system-billingStreet',
    fieldKey: 'billingStreet',
    fieldLabel: 'Billing Street',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: '123 Main Street',
    columnSpan: 2,
    displayOrder: 20,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-billingCity',
    fieldKey: 'billingCity',
    fieldLabel: 'Billing City',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'City',
    columnSpan: 1,
    displayOrder: 21,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-billingState',
    fieldKey: 'billingState',
    fieldLabel: 'Billing State',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'State',
    columnSpan: 1,
    displayOrder: 22,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-billingPostalCode',
    fieldKey: 'billingPostalCode',
    fieldLabel: 'Billing Postal Code',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: '12345',
    columnSpan: 1,
    displayOrder: 23,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-billingCountry',
    fieldKey: 'billingCountry',
    fieldLabel: 'Billing Country',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'Country',
    columnSpan: 1,
    displayOrder: 24,
    isSystem: true,
    isEditable: true,
  },
  
  // Other Section
  {
    id: 'system-description',
    fieldKey: 'description',
    fieldLabel: 'Description',
    fieldType: 'textarea',
    section: 'other',
    isRequired: false,
    placeholder: 'Additional notes...',
    columnSpan: 2,
    displayOrder: 40,
    isSystem: true,
    isEditable: true,
  },
];

// ==================== LEADS MODULE ====================

export const LEADS_SYSTEM_FIELDS: SystemFieldDefinition[] = [
  // Basic Info
  {
    id: 'system-firstName',
    fieldKey: 'firstName',
    fieldLabel: 'First Name',
    fieldType: 'text',
    section: 'basic',
    isRequired: true,
    placeholder: 'Enter first name',
    columnSpan: 1,
    displayOrder: 1,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-lastName',
    fieldKey: 'lastName',
    fieldLabel: 'Last Name',
    fieldType: 'text',
    section: 'basic',
    isRequired: true,
    placeholder: 'Enter last name',
    columnSpan: 1,
    displayOrder: 2,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-company',
    fieldKey: 'company',
    fieldLabel: 'Company',
    fieldType: 'text',
    section: 'basic',
    isRequired: false,
    placeholder: 'Company name',
    columnSpan: 1,
    displayOrder: 3,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-title',
    fieldKey: 'title',
    fieldLabel: 'Title',
    fieldType: 'text',
    section: 'basic',
    isRequired: false,
    placeholder: 'Job title',
    columnSpan: 1,
    displayOrder: 4,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-status',
    fieldKey: 'status',
    fieldLabel: 'Lead Status',
    fieldType: 'select',
    section: 'basic',
    isRequired: true,
    columnSpan: 1,
    displayOrder: 5,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-source',
    fieldKey: 'source',
    fieldLabel: 'Lead Source',
    fieldType: 'select',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 6,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-rating',
    fieldKey: 'rating',
    fieldLabel: 'Rating',
    fieldType: 'select',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 7,
    isSystem: true,
    isEditable: true,
  },
  
  // Contact Details
  {
    id: 'system-email',
    fieldKey: 'email',
    fieldLabel: 'Email',
    fieldType: 'email',
    section: 'contact',
    isRequired: false,
    placeholder: 'email@example.com',
    columnSpan: 1,
    displayOrder: 10,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-phone',
    fieldKey: 'phone',
    fieldLabel: 'Phone',
    fieldType: 'phone',
    section: 'contact',
    isRequired: false,
    placeholder: '+1 (555) 000-0000',
    columnSpan: 1,
    displayOrder: 11,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-mobile',
    fieldKey: 'mobile',
    fieldLabel: 'Mobile',
    fieldType: 'phone',
    section: 'contact',
    isRequired: false,
    placeholder: '+1 (555) 000-0000',
    columnSpan: 1,
    displayOrder: 12,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-website',
    fieldKey: 'website',
    fieldLabel: 'Website',
    fieldType: 'url',
    section: 'contact',
    isRequired: false,
    placeholder: 'https://example.com',
    columnSpan: 1,
    displayOrder: 13,
    isSystem: true,
    isEditable: true,
  },
  
  // Address
  {
    id: 'system-street',
    fieldKey: 'street',
    fieldLabel: 'Street',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: '123 Main Street',
    columnSpan: 2,
    displayOrder: 20,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-city',
    fieldKey: 'city',
    fieldLabel: 'City',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'City',
    columnSpan: 1,
    displayOrder: 21,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-state',
    fieldKey: 'state',
    fieldLabel: 'State/Province',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'State',
    columnSpan: 1,
    displayOrder: 22,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-postalCode',
    fieldKey: 'postalCode',
    fieldLabel: 'Postal Code',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: '12345',
    columnSpan: 1,
    displayOrder: 23,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-country',
    fieldKey: 'country',
    fieldLabel: 'Country',
    fieldType: 'text',
    section: 'address',
    isRequired: false,
    placeholder: 'Country',
    columnSpan: 1,
    displayOrder: 24,
    isSystem: true,
    isEditable: true,
  },
  
  // Other
  {
    id: 'system-description',
    fieldKey: 'description',
    fieldLabel: 'Description',
    fieldType: 'textarea',
    section: 'other',
    isRequired: false,
    placeholder: 'Additional notes...',
    columnSpan: 2,
    displayOrder: 40,
    isSystem: true,
    isEditable: true,
  },
];

// ==================== OPPORTUNITIES MODULE ====================

export const OPPORTUNITIES_SYSTEM_FIELDS: SystemFieldDefinition[] = [
  // Basic Info
  {
    id: 'system-name',
    fieldKey: 'name',
    fieldLabel: 'Opportunity Name',
    fieldType: 'text',
    section: 'basic',
    isRequired: true,
    placeholder: 'Enter opportunity name',
    columnSpan: 2,
    displayOrder: 1,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-accountId',
    fieldKey: 'accountId',
    fieldLabel: 'Account',
    fieldType: 'text',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 2,
    isSystem: true,
    isEditable: true,
    component: 'account-link',
  },
  {
    id: 'system-contactId',
    fieldKey: 'contactId',
    fieldLabel: 'Primary Contact',
    fieldType: 'text',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 3,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-stage',
    fieldKey: 'stage',
    fieldLabel: 'Stage',
    fieldType: 'select',
    section: 'basic',
    isRequired: true,
    columnSpan: 1,
    displayOrder: 4,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-probability',
    fieldKey: 'probability',
    fieldLabel: 'Probability (%)',
    fieldType: 'number',
    section: 'basic',
    isRequired: false,
    placeholder: '0-100',
    columnSpan: 1,
    displayOrder: 5,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-amount',
    fieldKey: 'amount',
    fieldLabel: 'Amount',
    fieldType: 'number',
    section: 'basic',
    isRequired: false,
    placeholder: 'Deal value',
    columnSpan: 1,
    displayOrder: 6,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-closeDate',
    fieldKey: 'closeDate',
    fieldLabel: 'Close Date',
    fieldType: 'date',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 7,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-type',
    fieldKey: 'type',
    fieldLabel: 'Type',
    fieldType: 'select',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 8,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-leadSource',
    fieldKey: 'leadSource',
    fieldLabel: 'Lead Source',
    fieldType: 'select',
    section: 'basic',
    isRequired: false,
    columnSpan: 1,
    displayOrder: 9,
    isSystem: true,
    isEditable: true,
  },
  
  // Other
  {
    id: 'system-description',
    fieldKey: 'description',
    fieldLabel: 'Description',
    fieldType: 'textarea',
    section: 'other',
    isRequired: false,
    placeholder: 'Additional notes...',
    columnSpan: 2,
    displayOrder: 40,
    isSystem: true,
    isEditable: true,
  },
  {
    id: 'system-nextStep',
    fieldKey: 'nextStep',
    fieldLabel: 'Next Step',
    fieldType: 'text',
    section: 'other',
    isRequired: false,
    placeholder: 'Next action to take',
    columnSpan: 2,
    displayOrder: 41,
    isSystem: true,
    isEditable: true,
  },
];

// ==================== FIELD REGISTRY ====================

export const SYSTEM_FIELDS_BY_MODULE: Record<string, SystemFieldDefinition[]> = {
  contacts: CONTACTS_SYSTEM_FIELDS,
  accounts: ACCOUNTS_SYSTEM_FIELDS,
  leads: LEADS_SYSTEM_FIELDS,
  opportunities: OPPORTUNITIES_SYSTEM_FIELDS,
};

/**
 * Get all fields (system + custom) for a module, merged and sorted
 */
export function getAllFields(
  module: string,
  customFields: CustomField[]
): (SystemFieldDefinition | CustomField)[] {
  const systemFields = SYSTEM_FIELDS_BY_MODULE[module] || [];
  
  // Merge system fields with additional properties for compatibility
  const allFields = [
    ...systemFields.map(sf => ({
      ...sf,
      module,
      fieldOptions: [] as { label: string; value: string }[],
      defaultValue: null,
      validationRules: sf.validationRules || {},
      includeInCompletion: true,
      completionWeight: 10,
      isActive: true,
      dependsOnFieldId: null,
      conditionalOptions: {},
      groupId: null,
      tabId: null,
      createdAt: '',
      updatedAt: '',
    })),
    ...customFields,
  ];
  
  // Sort by section, then displayOrder
  return allFields.sort((a, b) => {
    if (a.section !== b.section) {
      const sectionOrder = ['basic', 'contact', 'address', 'social', 'other', 'custom'];
      return sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section);
    }
    return a.displayOrder - b.displayOrder;
  });
}

/**
 * Get fields for a specific section
 */
export function getFieldsForSection(
  module: string,
  section: string,
  customFields: CustomField[]
): (SystemFieldDefinition | CustomField)[] {
  const allFields = getAllFields(module, customFields);
  return allFields.filter(f => f.section === section && !('tabId' in f && f.tabId));
}

/**
 * Check if a field is a system field
 */
export function isSystemField(field: SystemFieldDefinition | CustomField): field is SystemFieldDefinition {
  return 'isSystem' in field && field.isSystem === true;
}

/**
 * Get system field by key
 */
export function getSystemField(module: string, fieldKey: string): SystemFieldDefinition | undefined {
  return SYSTEM_FIELDS_BY_MODULE[module]?.find(f => f.fieldKey === fieldKey);
}