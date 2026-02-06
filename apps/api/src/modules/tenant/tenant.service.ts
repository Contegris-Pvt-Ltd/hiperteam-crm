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

    // Create users table in tenant schema
    await this.dataSource.query(`
      CREATE TABLE "${schemaName}".users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255) UNIQUE NOT NULL,
        password_hash   VARCHAR(255) NOT NULL,
        first_name      VARCHAR(100) NOT NULL,
        last_name       VARCHAR(100) NOT NULL,
        phone           VARCHAR(50),
        role            VARCHAR(50) DEFAULT 'user',
        status          VARCHAR(20) DEFAULT 'active',
        last_login_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ
      )
    `);

    // Create index
    await this.dataSource.query(`
      CREATE INDEX "idx_${schemaName}_users_email" ON "${schemaName}".users(email)
    `);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantRepository.find({ where: { status: 'active' } });
  }
}