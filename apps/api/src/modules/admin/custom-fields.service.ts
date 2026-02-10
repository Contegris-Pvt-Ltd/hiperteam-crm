import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CustomFieldDefinition {
  id: string;
  module: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldOptions: { label: string; value: string }[];
  isRequired: boolean;
  defaultValue: string | null;
  validationRules: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  displayOrder: number;
  placeholder: string | null;
  helpText: string | null;
  includeInCompletion: boolean;
  completionWeight: number;
  isActive: boolean;
  dependsOnFieldId: string | null;
  dependsOnField?: { id: string; fieldKey: string; fieldLabel: string };
  conditionalOptions: Record<string, { label: string; value: string }[]>;
  // New fields
  groupId: string | null;
  tabId: string | null;
  section: string;
  columnSpan: number;
  group?: { id: string; name: string };
  tab?: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomFieldDto {
  module: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldOptions?: { label: string; value: string }[];
  isRequired?: boolean;
  defaultValue?: string;
  validationRules?: Record<string, unknown>;
  displayOrder?: number;
  placeholder?: string;
  helpText?: string;
  includeInCompletion?: boolean;
  completionWeight?: number;
  dependsOnFieldId?: string;
  conditionalOptions?: Record<string, { label: string; value: string }[]>;
  groupId?: string;
  tabId?: string;
  section?: string;
  columnSpan?: number;
}

@Injectable()
export class CustomFieldsService {
  constructor(private dataSource: DataSource) {}

  async findByModule(schemaName: string, module: string): Promise<CustomFieldDefinition[]> {
    const result = await this.dataSource.query(
      `SELECT f.*, 
        d.field_key as depends_on_field_key, 
        d.field_label as depends_on_field_label,
        g.name as group_name,
        t.name as tab_name
       FROM "${schemaName}".custom_field_definitions f
       LEFT JOIN "${schemaName}".custom_field_definitions d ON f.depends_on_field_id = d.id
       LEFT JOIN "${schemaName}".custom_field_groups g ON f.group_id = g.id
       LEFT JOIN "${schemaName}".custom_tabs t ON f.tab_id = t.id
       WHERE f.module = $1
       ORDER BY f.display_order ASC`,
      [module]
    );
    return result.map((row: Record<string, unknown>) => this.formatField(row));
  }

  async findAll(schemaName: string): Promise<CustomFieldDefinition[]> {
    const fields = await this.dataSource.query(
      `SELECT cfd.*, 
              parent.field_key as parent_field_key,
              parent.field_label as parent_field_label
      FROM "${schemaName}".custom_field_definitions cfd
      LEFT JOIN "${schemaName}".custom_field_definitions parent ON cfd.depends_on_field_id = parent.id
      ORDER BY cfd.module ASC, cfd.display_order ASC, cfd.created_at ASC`,
    );

    return fields.map((f: Record<string, unknown>) => this.formatField(f));
  }

  async findOne(schemaName: string, id: string): Promise<CustomFieldDefinition> {
    const result = await this.dataSource.query(
      `SELECT f.*, 
        d.field_key as depends_on_field_key, 
        d.field_label as depends_on_field_label,
        g.name as group_name,
        t.name as tab_name
       FROM "${schemaName}".custom_field_definitions f
       LEFT JOIN "${schemaName}".custom_field_definitions d ON f.depends_on_field_id = d.id
       LEFT JOIN "${schemaName}".custom_field_groups g ON f.group_id = g.id
       LEFT JOIN "${schemaName}".custom_tabs t ON f.tab_id = t.id
       WHERE f.id = $1`,
      [id]
    );
    if (!result.length) {
      throw new NotFoundException('Custom field not found');
    }
    return this.formatField(result[0]);
  }

  async create(schemaName: string, dto: CreateCustomFieldDto): Promise<CustomFieldDefinition> {
    // Check for duplicate field key
    const existing = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".custom_field_definitions 
       WHERE module = $1 AND field_key = $2`,
      [dto.module, dto.fieldKey]
    );
    if (existing.length) {
      throw new BadRequestException('Field key already exists for this module');
    }

    // Check for circular dependency
    if (dto.dependsOnFieldId) {
      const [targetField] = await this.dataSource.query(
        `SELECT depends_on_field_id FROM "${schemaName}".custom_field_definitions WHERE id = $1`,
        [dto.dependsOnFieldId],
      );
      if (targetField?.depends_on_field_id) {
        throw new BadRequestException('Cannot create multi-level dependency');
      }
    }

    // Get max display order
    const maxOrderResult = await this.dataSource.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
       FROM "${schemaName}".custom_field_definitions WHERE module = $1`,
      [dto.module]
    );
    const displayOrder = dto.displayOrder ?? maxOrderResult[0].next_order;

    const result = await this.dataSource.query(
      `INSERT INTO "${schemaName}".custom_field_definitions 
       (module, field_key, field_label, field_type, field_options, is_required, 
        default_value, validation_rules, display_order, placeholder, help_text,
        include_in_completion, completion_weight, depends_on_field_id, conditional_options,
        group_id, tab_id, section, column_span)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id`,
      [
        dto.module,
        dto.fieldKey,
        dto.fieldLabel,
        dto.fieldType,
        JSON.stringify(dto.fieldOptions || []),
        dto.isRequired || false,
        dto.defaultValue || null,
        JSON.stringify(dto.validationRules || {}),
        displayOrder,
        dto.placeholder || null,
        dto.helpText || null,
        dto.includeInCompletion || false,
        dto.completionWeight || 5,
        dto.dependsOnFieldId || null,
        JSON.stringify(dto.conditionalOptions || {}),
        dto.groupId || null,
        dto.tabId || null,
        dto.section || 'custom',
        dto.columnSpan || 1,
      ]
    );

    return this.findOne(schemaName, result[0].id);
  }

  async update(schemaName: string, id: string, dto: Partial<CreateCustomFieldDto>): Promise<CustomFieldDefinition> {
  // First verify the field exists
  const existing = await this.findOne(schemaName, id);

  // Check for duplicate field key if changing
  if (dto.fieldKey && dto.fieldKey !== existing.fieldKey) {
    const [duplicate] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".custom_field_definitions 
      WHERE module = $1 AND field_key = $2 AND id != $3`,
      [existing.module, dto.fieldKey, id],
    );

    if (duplicate) {
      throw new BadRequestException(`Field key "${dto.fieldKey}" already exists`);
    }
  }

  // Prevent circular dependencies
  if (dto.dependsOnFieldId) {
    if (dto.dependsOnFieldId === id) {
      throw new BadRequestException('A field cannot depend on itself');
    }
    const [targetField] = await this.dataSource.query(
      `SELECT depends_on_field_id FROM "${schemaName}".custom_field_definitions WHERE id = $1`,
      [dto.dependsOnFieldId],
    );
    if (targetField?.depends_on_field_id === id) {
      throw new BadRequestException('Circular dependency detected');
    }
  }

  // Determine final values - handle undefined vs null properly
  const finalSection = dto.tabId ? 'custom' : (dto.section !== undefined ? dto.section : existing.section);
  const finalTabId = dto.tabId !== undefined ? (dto.tabId || null) : existing.tabId;
  const finalGroupId = dto.groupId !== undefined ? (dto.groupId || null) : existing.groupId;

  await this.dataSource.query(
    `UPDATE "${schemaName}".custom_field_definitions SET
      field_key = COALESCE($2, field_key),
      field_label = COALESCE($3, field_label),
      field_type = COALESCE($4, field_type),
      field_options = COALESCE($5, field_options),
      is_required = COALESCE($6, is_required),
      default_value = $7,
      validation_rules = COALESCE($8, validation_rules),
      display_order = COALESCE($9, display_order),
      section = $10,
      placeholder = $11,
      help_text = $12,
      include_in_completion = COALESCE($13, include_in_completion),
      completion_weight = COALESCE($14, completion_weight),
      depends_on_field_id = $15,
      conditional_options = COALESCE($16, conditional_options),
      group_id = $17,
      tab_id = $18,
      column_span = COALESCE($19, column_span),
      updated_at = NOW()
    WHERE id = $1`,
    [
      id,
      dto.fieldKey,
      dto.fieldLabel,
      dto.fieldType,
      dto.fieldOptions ? JSON.stringify(dto.fieldOptions) : null,
      dto.isRequired,
      dto.defaultValue !== undefined ? dto.defaultValue : existing.defaultValue,
      dto.validationRules ? JSON.stringify(dto.validationRules) : null,
      dto.displayOrder,
      finalSection,
      dto.placeholder !== undefined ? dto.placeholder : existing.placeholder,
      dto.helpText !== undefined ? dto.helpText : existing.helpText,
      dto.includeInCompletion,
      dto.completionWeight,
      dto.dependsOnFieldId !== undefined ? (dto.dependsOnFieldId || null) : existing.dependsOnFieldId,
      dto.conditionalOptions ? JSON.stringify(dto.conditionalOptions) : null,
      finalGroupId,
      finalTabId,
      dto.columnSpan,
    ],
  );

  // Return the updated field
  return this.findOne(schemaName, id);
}

  async toggleActive(schemaName: string, id: string): Promise<CustomFieldDefinition> {
    const [field] = await this.dataSource.query(
      `UPDATE "${schemaName}".custom_field_definitions 
       SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    return this.formatField(field);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const result = await this.dataSource.query(
      `DELETE FROM "${schemaName}".custom_field_definitions WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException('Custom field not found');
    }
  }

  async reorder(schemaName: string, module: string, fieldIds: string[]): Promise<void> {
    for (let i = 0; i < fieldIds.length; i++) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".custom_field_definitions 
         SET display_order = $2, updated_at = NOW()
         WHERE id = $1 AND module = $3`,
        [fieldIds[i], i + 1, module],
      );
    }
  }

  private formatField(row: Record<string, unknown>): CustomFieldDefinition {
    return {
      id: row.id as string,
      module: row.module as string,
      fieldKey: row.field_key as string,
      fieldLabel: row.field_label as string,
      fieldType: row.field_type as string,
      fieldOptions: (row.field_options as { label: string; value: string }[]) || [],
      isRequired: row.is_required as boolean,
      defaultValue: row.default_value as string | null,
      validationRules: (row.validation_rules as Record<string, unknown>) || {},
      displayOrder: row.display_order as number,
      placeholder: row.placeholder as string | null,
      helpText: row.help_text as string | null,
      includeInCompletion: row.include_in_completion as boolean,
      completionWeight: row.completion_weight as number,
      isActive: row.is_active as boolean,
      dependsOnFieldId: row.depends_on_field_id as string | null,
      dependsOnField: row.depends_on_field_key ? {
        id: row.depends_on_field_id as string,
        fieldKey: row.depends_on_field_key as string,
        fieldLabel: row.depends_on_field_label as string,
      } : undefined,
      conditionalOptions: (row.conditional_options as Record<string, { label: string; value: string }[]>) || {},
      // New fields
      groupId: row.group_id as string | null,
      tabId: row.tab_id as string | null,
      section: (row.section as string) || 'custom',
      columnSpan: (row.column_span as number) || 1,
      group: row.group_name ? { id: row.group_id as string, name: row.group_name as string } : undefined,
      tab: row.tab_name ? { id: row.tab_id as string, name: row.tab_name as string } : undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}