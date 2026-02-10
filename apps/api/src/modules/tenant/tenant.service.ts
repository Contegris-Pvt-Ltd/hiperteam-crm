import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { TenantSchemaService } from '../../database/tenant-schema.service';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private tenantSchemaService: TenantSchemaService,
  ) {}

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { slug, status: 'active' } });
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { id } });
  }

  async create(name: string, slug: string): Promise<Tenant> {
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    const tenant = this.tenantRepository.create({
      name,
      slug,
      schemaName,
    });
    await this.tenantRepository.save(tenant);

    // Create tenant schema with all tables
    await this.tenantSchemaService.createTenantSchema(schemaName);

    return tenant;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantRepository.find({ where: { status: 'active' } });
  }
}