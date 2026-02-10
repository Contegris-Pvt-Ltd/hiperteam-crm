import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePageLayoutsTable1707500000000 implements MigrationInterface {
  name = 'CreatePageLayoutsTable1707500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create page_layouts table
    await queryRunner.createTable(
      new Table({
        name: 'page_layouts',
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
            comment: 'detail, edit, or create',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'config',
            type: 'jsonb',
            isNullable: false,
            comment: 'Page layout configuration with template and widgets',
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create index for fast lookups
    await queryRunner.createIndex(
      'page_layouts',
      new TableIndex({
        name: 'IDX_page_layouts_tenant_module_type',
        columnNames: ['tenant_id', 'module', 'layout_type'],
      }),
    );

    // Create index for default lookup
    await queryRunner.createIndex(
      'page_layouts',
      new TableIndex({
        name: 'IDX_page_layouts_default',
        columnNames: ['tenant_id', 'module', 'layout_type', 'is_default'],
        where: 'is_default = true',
      }),
    );

    // Add comment to table
    await queryRunner.query(`
      COMMENT ON TABLE page_layouts IS 'Stores custom page layout configurations for each module''s detail/edit/create views';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('page_layouts', true, true, true);
  }
}