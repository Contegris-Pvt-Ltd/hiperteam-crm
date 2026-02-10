import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateModuleLayoutSettingsTable1707600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'module_layout_settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'module',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'layout_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'use_custom_layout',
            type: 'boolean',
            default: false,
          },
          {
            name: 'layout_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Unique index on tenant + module + layoutType
    await queryRunner.createIndex(
      'module_layout_settings',
      new TableIndex({
        name: 'IDX_module_layout_settings_unique',
        columnNames: ['tenant_id', 'module', 'layout_type'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('module_layout_settings', 'IDX_module_layout_settings_unique');
    await queryRunner.dropTable('module_layout_settings');
  }
}