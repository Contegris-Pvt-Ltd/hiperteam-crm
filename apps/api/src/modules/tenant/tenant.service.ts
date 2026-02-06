import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private dataSource: DataSource,
  ) {}

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { slug, status: 'active' } });
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { id } });
  }

  async create(name: string, slug: string): Promise<Tenant> {
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    // Create tenant record
    const tenant = this.tenantRepository.create({
      name,
      slug,
      schemaName,
    });
    await this.tenantRepository.save(tenant);

    // Create tenant schema and tables
    await this.createTenantSchema(schemaName);

    return tenant;
  }

  private async createTenantSchema(schemaName: string): Promise<void> {
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Roles table
    await this.dataSource.query(`
      CREATE TABLE "${schemaName}".roles (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(100) NOT NULL,
        description     TEXT,
        permissions     JSONB DEFAULT '{}',
        is_system       BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Insert default roles
    await this.dataSource.query(`
      INSERT INTO "${schemaName}".roles (name, description, permissions, is_system) VALUES
      ('admin', 'Full access to everything', '{"*": {"*": "all"}}', true),
      ('manager', 'Manage team and data', '{"contacts": {"*": "team"}, "leads": {"*": "team"}, "users": {"view": "team"}}', true),
      ('user', 'Standard user access', '{"contacts": {"*": "own"}, "leads": {"*": "own"}}', true)
    `);

    // Users table with role reference
    await this.dataSource.query(`
      CREATE TABLE "${schemaName}".users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255) UNIQUE NOT NULL,
        password_hash   VARCHAR(255) NOT NULL,
        first_name      VARCHAR(100) NOT NULL,
        last_name       VARCHAR(100) NOT NULL,
        phone           VARCHAR(50),
        role_id         UUID REFERENCES "${schemaName}".roles(id),
        status          VARCHAR(20) DEFAULT 'active',
        last_login_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ
      )
    `);

    // Create indexes
    await this.dataSource.query(`
      CREATE INDEX "idx_${schemaName}_users_email" ON "${schemaName}".users(email)
    `);
    await this.dataSource.query(`
      CREATE INDEX "idx_${schemaName}_users_role" ON "${schemaName}".users(role_id)
    `);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantRepository.find({ where: { status: 'active' } });
  }
}