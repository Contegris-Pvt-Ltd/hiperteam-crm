import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePageLayoutsTables1707600000000 implements MigrationInterface {
  name = 'CreatePageLayoutsTables1707600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get all tenant schemas
    const tenants = await queryRunner.query(`
      SELECT schema_name FROM tenants WHERE is_active = true
    `);

    for (const tenant of tenants) {
      const schema = tenant.schema_name;

      // Create page_layouts table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".page_layouts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          module VARCHAR(50) NOT NULL,
          layout_type VARCHAR(20) NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          is_default BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          config JSONB NOT NULL,
          created_by UUID,
          updated_by UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for page_layouts
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_page_layouts_module_type 
        ON "${schema}".page_layouts(module, layout_type)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_page_layouts_default 
        ON "${schema}".page_layouts(module, layout_type, is_default) 
        WHERE is_default = true
      `);

      // Create module_layout_settings table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".module_layout_settings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          module VARCHAR(50) NOT NULL,
          layout_type VARCHAR(20) NOT NULL,
          use_custom_layout BOOLEAN DEFAULT false,
          layout_id UUID REFERENCES "${schema}".page_layouts(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(module, layout_type)
        )
      `);

      // Create index for module_layout_settings
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_module_layout_settings_module_type 
        ON "${schema}".module_layout_settings(module, layout_type)
      `);

      console.log(`Created page_layouts tables in schema: ${schema}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get all tenant schemas
    const tenants = await queryRunner.query(`
      SELECT schema_name FROM tenants WHERE is_active = true
    `);

    for (const tenant of tenants) {
      const schema = tenant.schema_name;

      // Drop module_layout_settings first (has FK to page_layouts)
      await queryRunner.query(`
        DROP TABLE IF EXISTS "${schema}".module_layout_settings CASCADE
      `);

      // Drop page_layouts
      await queryRunner.query(`
        DROP TABLE IF EXISTS "${schema}".page_layouts CASCADE
      `);

      console.log(`Dropped page_layouts tables from schema: ${schema}`);
    }
  }
}