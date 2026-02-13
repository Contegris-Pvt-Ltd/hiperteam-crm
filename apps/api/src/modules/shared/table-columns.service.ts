// ============================================================
// FILE: apps/api/src/modules/shared/table-columns.service.ts
// ============================================================
//
// Single source of truth for DataTable columns per module.
// Returns: system fields + custom fields + computed/joined columns
//
// Called by: GET /table-columns/:module
// ============================================================
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

// ============================================================
// TYPES
// ============================================================

export type ColumnType =
  | 'text' | 'number' | 'date' | 'datetime' | 'badge' | 'avatar'
  | 'boolean' | 'currency' | 'link' | 'tags' | 'custom';

export interface TableColumn {
  key: string;              // field key (e.g. 'firstName', 'customFields.department')
  label: string;            // display header
  type: ColumnType;         // rendering type
  sortKey?: string;         // backend sort key (null = not sortable)
  sortable: boolean;
  defaultVisible: boolean;
  defaultWidth: number;
  frozen?: boolean;         // sticky left
  align?: 'left' | 'center' | 'right';
  isCustomField: boolean;
  badgeColors?: Record<string, string>;
  source: 'system' | 'computed' | 'custom' | 'utility';
}

// ============================================================
// FIELD TYPE → COLUMN TYPE MAPPER
// ============================================================

const FIELD_TYPE_MAP: Record<string, ColumnType> = {
  text: 'text',
  textarea: 'text',
  number: 'number',
  date: 'date',
  select: 'badge',
  multi_select: 'tags',
  checkbox: 'boolean',
  url: 'link',
  email: 'text',
  phone: 'text',
  file: 'text',
};

function mapFieldType(fieldType: string): ColumnType {
  return FIELD_TYPE_MAP[fieldType] || 'text';
}

function getDefaultWidth(fieldType: string, fieldKey: string): number {
  if (fieldKey === 'name') return 280;
  if (fieldKey === 'email') return 220;
  if (fieldKey === 'phone' || fieldKey === 'mobile') return 150;
  if (fieldKey === 'website') return 200;
  if (fieldType === 'number') return 100;
  if (fieldType === 'date') return 130;
  if (fieldType === 'select') return 130;
  if (fieldType === 'checkbox') return 90;
  if (fieldType === 'multi_select') return 200;
  if (fieldType === 'textarea') return 250;
  if (fieldType === 'url') return 200;
  return 150;
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// ============================================================
// SYSTEM FIELDS PER MODULE
// These are the DB columns that exist directly on the table
// We skip fields already covered by computed columns (e.g. firstName
// + lastName are merged into computed 'name' for leads/contacts)
// ============================================================

interface SystemFieldDef {
  key: string;
  label: string;
  fieldType: string;   // maps via FIELD_TYPE_MAP
  sortKey?: string;     // override sort key
  defaultVisible?: boolean;
  section?: string;     // basic, contact, address, social, other
}

const SYSTEM_FIELDS: Record<string, SystemFieldDef[]> = {
  leads: [
    // firstName/lastName handled by computed 'name' column
    { key: 'email', label: 'Email', fieldType: 'email', defaultVisible: true },
    { key: 'phone', label: 'Phone', fieldType: 'phone', defaultVisible: true },
    { key: 'mobile', label: 'Mobile', fieldType: 'phone' },
    { key: 'company', label: 'Company', fieldType: 'text', defaultVisible: true },
    { key: 'jobTitle', label: 'Job Title', fieldType: 'text' },
    { key: 'source', label: 'Source', fieldType: 'select', defaultVisible: true },
    { key: 'website', label: 'Website', fieldType: 'url' },
    { key: 'city', label: 'City', fieldType: 'text' },
    { key: 'state', label: 'State', fieldType: 'text' },
    { key: 'country', label: 'Country', fieldType: 'text' },
    { key: 'tags', label: 'Tags', fieldType: 'multi_select' },
  ],
  contacts: [
    // firstName/lastName handled by computed 'name' column
    { key: 'email', label: 'Email', fieldType: 'email', defaultVisible: true },
    { key: 'phone', label: 'Phone', fieldType: 'phone', defaultVisible: true },
    { key: 'mobile', label: 'Mobile', fieldType: 'phone' },
    { key: 'company', label: 'Company', fieldType: 'text', defaultVisible: true },
    { key: 'jobTitle', label: 'Job Title', fieldType: 'text', defaultVisible: true },
    { key: 'status', label: 'Status', fieldType: 'select', defaultVisible: true },
    { key: 'website', label: 'Website', fieldType: 'url' },
    { key: 'city', label: 'City', fieldType: 'text' },
    { key: 'state', label: 'State', fieldType: 'text' },
    { key: 'country', label: 'Country', fieldType: 'text' },
    { key: 'tags', label: 'Tags', fieldType: 'multi_select' },
  ],
  accounts: [
    { key: 'name', label: 'Name', fieldType: 'text', defaultVisible: true },
    { key: 'industry', label: 'Industry', fieldType: 'select', defaultVisible: true },
    { key: 'accountType', label: 'Type', fieldType: 'select', defaultVisible: true, sortKey: 'account_type' },
    { key: 'website', label: 'Website', fieldType: 'url', defaultVisible: true },
    { key: 'status', label: 'Status', fieldType: 'select', defaultVisible: true },
    { key: 'companySize', label: 'Size', fieldType: 'text' },
    { key: 'annualRevenue', label: 'Revenue', fieldType: 'number' },
    { key: 'tags', label: 'Tags', fieldType: 'multi_select' },
  ],
  products: [
    { key: 'name', label: 'Product', fieldType: 'text', defaultVisible: true },
    { key: 'code', label: 'Code', fieldType: 'text', defaultVisible: true },
    { key: 'type', label: 'Type', fieldType: 'select', defaultVisible: true },
    { key: 'basePrice', label: 'Price', fieldType: 'number', defaultVisible: true, sortKey: 'base_price' },
    { key: 'status', label: 'Status', fieldType: 'select', defaultVisible: true },
    { key: 'shortDescription', label: 'Description', fieldType: 'textarea' },
    { key: 'currency', label: 'Currency', fieldType: 'text' },
    { key: 'taxCategory', label: 'Tax Category', fieldType: 'text' },
  ],
  users: [
    { key: 'email', label: 'Email', fieldType: 'email', defaultVisible: true },
    { key: 'status', label: 'Status', fieldType: 'select', defaultVisible: true },
    { key: 'jobTitle', label: 'Job Title', fieldType: 'text' },
  ],
  departments: [
    { key: 'name', label: 'Name', fieldType: 'text', defaultVisible: true },
    { key: 'code', label: 'Code', fieldType: 'text', defaultVisible: true },
    { key: 'description', label: 'Description', fieldType: 'textarea' },
    { key: 'isActive', label: 'Active', fieldType: 'checkbox', defaultVisible: true, sortKey: 'is_active' },
  ],
  teams: [
    { key: 'name', label: 'Name', fieldType: 'text', defaultVisible: true },
    { key: 'description', label: 'Description', fieldType: 'textarea' },
    { key: 'isActive', label: 'Active', fieldType: 'checkbox', defaultVisible: true, sortKey: 'is_active' },
  ],
  roles: [
    { key: 'name', label: 'Name', fieldType: 'text', defaultVisible: true },
    { key: 'description', label: 'Description', fieldType: 'textarea' },
    { key: 'level', label: 'Level', fieldType: 'number', defaultVisible: true },
    { key: 'isSystem', label: 'System', fieldType: 'checkbox', defaultVisible: true, sortKey: 'is_system' },
    { key: 'isCustom', label: 'Custom', fieldType: 'checkbox' },
  ],
};

// ============================================================
// COMPUTED / JOINED COLUMNS PER MODULE
// These come from SQL JOINs — they don't exist as DB columns
// or in custom_field_definitions
// ============================================================

const COMPUTED_COLUMNS: Record<string, TableColumn[]> = {
  leads: [
    { key: 'name', label: 'Name', type: 'text', sortKey: 'name', sortable: true, defaultVisible: true, defaultWidth: 280, frozen: true, isCustomField: false, source: 'computed' },
    { key: 'stageName', label: 'Stage', type: 'badge', sortKey: 'stage', sortable: true, defaultVisible: true, defaultWidth: 130, isCustomField: false, source: 'computed' },
    { key: 'priorityName', label: 'Priority', type: 'badge', sortKey: 'priority', sortable: true, defaultVisible: true, defaultWidth: 120, isCustomField: false, source: 'computed' },
    { key: 'score', label: 'Score', type: 'number', sortKey: 'score', sortable: true, defaultVisible: true, defaultWidth: 80, align: 'center', isCustomField: false, source: 'computed' },
    { key: 'ownerName', label: 'Owner', type: 'text', sortKey: 'owner', sortable: true, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
    { key: 'convertedStatus', label: 'Status', type: 'badge', sortable: false, defaultVisible: false, defaultWidth: 110, isCustomField: false, source: 'computed',
      badgeColors: { active: 'blue', converted: 'green', disqualified: 'red' },
    },
    { key: 'lastActivityAt', label: 'Last Activity', type: 'datetime', sortKey: 'last_activity_at', sortable: true, defaultVisible: false, defaultWidth: 160, isCustomField: false, source: 'computed' },
  ],
  contacts: [
    { key: 'name', label: 'Name', type: 'text', sortKey: 'first_name', sortable: true, defaultVisible: true, defaultWidth: 280, frozen: true, isCustomField: false, source: 'computed' },
    { key: 'ownerName', label: 'Owner', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
    { key: 'accountName', label: 'Account', type: 'text', sortable: false, defaultVisible: false, defaultWidth: 180, isCustomField: false, source: 'computed' },
  ],
  accounts: [
    { key: 'ownerName', label: 'Owner', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
    { key: 'parentAccountName', label: 'Parent Account', type: 'text', sortable: false, defaultVisible: false, defaultWidth: 180, isCustomField: false, source: 'computed' },
    { key: 'contactsCount', label: 'Contacts', type: 'number', sortable: false, defaultVisible: true, defaultWidth: 100, align: 'center', isCustomField: false, source: 'computed' },
  ],
  products: [
    { key: 'categoryName', label: 'Category', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 150, isCustomField: false, source: 'computed' },
  ],
  users: [
    { key: 'name', label: 'Name', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 280, frozen: true, isCustomField: false, source: 'computed' },
    { key: 'roleName', label: 'Role', type: 'badge', sortable: false, defaultVisible: true, defaultWidth: 130, isCustomField: false, source: 'computed' },
    { key: 'departmentName', label: 'Department', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
    { key: 'lastLoginAt', label: 'Last Login', type: 'datetime', sortable: false, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
  ],
  departments: [
    { key: 'headName', label: 'Head', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
    { key: 'parentDepartmentName', label: 'Parent', type: 'text', sortable: false, defaultVisible: false, defaultWidth: 180, isCustomField: false, source: 'computed' },
    { key: 'memberCount', label: 'Members', type: 'number', sortable: false, defaultVisible: true, defaultWidth: 100, align: 'center', isCustomField: false, source: 'computed' },
    { key: 'teamCount', label: 'Teams', type: 'number', sortable: false, defaultVisible: true, defaultWidth: 90, align: 'center', isCustomField: false, source: 'computed' },
  ],
  teams: [
    { key: 'departmentName', label: 'Department', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
    { key: 'teamLeadName', label: 'Team Lead', type: 'text', sortable: false, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'computed' },
    { key: 'memberCount', label: 'Members', type: 'number', sortable: false, defaultVisible: true, defaultWidth: 100, align: 'center', isCustomField: false, source: 'computed' },
  ],
  roles: [
    { key: 'usersCount', label: 'Users', type: 'number', sortable: false, defaultVisible: true, defaultWidth: 90, align: 'center', isCustomField: false, source: 'computed' },
  ],
};

// ============================================================
// UTILITY COLUMNS — always appended last
// ============================================================

const UTILITY_COLUMNS: TableColumn[] = [
  { key: 'createdAt', label: 'Created', type: 'datetime', sortKey: 'created_at', sortable: true, defaultVisible: true, defaultWidth: 160, isCustomField: false, source: 'utility' },
  { key: 'updatedAt', label: 'Updated', type: 'datetime', sortKey: 'updated_at', sortable: true, defaultVisible: false, defaultWidth: 160, isCustomField: false, source: 'utility' },
];

// ============================================================
// MODULES THAT SUPPORT CUSTOM FIELDS
// (departments, teams, roles do NOT have custom_field_definitions)
// ============================================================

const CUSTOM_FIELD_MODULES = new Set(['leads', 'contacts', 'accounts', 'products', 'opportunities']);

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class TableColumnsService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get all available table columns for a module.
   * Order: computed (frozen first) → system → custom → utility
   */
  async getColumns(schemaName: string, module: string): Promise<TableColumn[]> {
    const columns: TableColumn[] = [];
    const addedKeys = new Set<string>();

    // ── 1. Computed/joined columns (frozen ones first) ──
    const computed = COMPUTED_COLUMNS[module] || [];
    const frozen = computed.filter(c => c.frozen);
    const nonFrozen = computed.filter(c => !c.frozen);

    for (const col of [...frozen, ...nonFrozen]) {
      columns.push(col);
      addedKeys.add(col.key);
    }

    // ── 2. System fields ──
    const systemFields = SYSTEM_FIELDS[module] || [];
    for (const field of systemFields) {
      if (addedKeys.has(field.key)) continue; // skip if already covered by computed

      const colType = mapFieldType(field.fieldType);
      const sortKey = field.sortKey || toSnakeCase(field.key);
      const sortable = !['textarea', 'file', 'multi_select'].includes(field.fieldType);

      columns.push({
        key: field.key,
        label: field.label,
        type: colType === 'number' && field.key === 'annualRevenue' ? 'currency' : colType,
        sortKey: sortable ? sortKey : undefined,
        sortable,
        defaultVisible: field.defaultVisible ?? false,
        defaultWidth: getDefaultWidth(field.fieldType, field.key),
        isCustomField: false,
        align: colType === 'number' || colType === 'currency' ? 'right' : undefined,
        source: 'system',
      });
      addedKeys.add(field.key);
    }

    // ── 3. Custom fields (from custom_field_definitions table) ──
    if (CUSTOM_FIELD_MODULES.has(module)) {
      try {
        const customFields = await this.dataSource.query(
          `SELECT field_key, field_label, field_type
           FROM "${schemaName}".custom_field_definitions
           WHERE module = $1 AND is_active = true
           ORDER BY display_order ASC`,
          [module],
        );

        for (const cf of customFields) {
          const key = `customFields.${cf.field_key}`;
          if (addedKeys.has(key)) continue;

          columns.push({
            key,
            label: cf.field_label,
            type: mapFieldType(cf.field_type),
            sortable: false, // JSONB columns not sortable server-side
            defaultVisible: false,
            defaultWidth: getDefaultWidth(cf.field_type, cf.field_key),
            isCustomField: true,
            source: 'custom',
          });
          addedKeys.add(key);
        }
      } catch {
        // Table may not exist in this schema yet — safe to skip
      }
    }

    // ── 4. Utility columns (always last) ──
    for (const col of UTILITY_COLUMNS) {
      if (!addedKeys.has(col.key)) {
        columns.push(col);
        addedKeys.add(col.key);
      }
    }

    return columns;
  }
}