import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantService } from '../tenant/tenant.service';
import { RegisterDto, LoginDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private tenantService: TenantService,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto) {
    // Check if tenant slug already exists
    const existingTenant = await this.tenantService.findBySlug(dto.companySlug);
    if (existingTenant) {
      throw new ConflictException('Company slug already taken');
    }

    // Create tenant (this also creates the schema with roles)
    const tenant = await this.tenantService.create(dto.companyName, dto.companySlug);

    // Get admin role
    const [adminRole] = await this.dataSource.query(
      `SELECT id FROM "${tenant.schemaName}".roles WHERE name = 'admin' LIMIT 1`
    );

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create admin user in tenant schema
    await this.dataSource.query(
      `INSERT INTO "${tenant.schemaName}".users 
       (email, password_hash, first_name, last_name, role_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [dto.email, passwordHash, dto.firstName, dto.lastName, adminRole.id],
    );

    // Get the created user with role
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, r.name as role, r.permissions
       FROM "${tenant.schemaName}".users u
       JOIN "${tenant.schemaName}".roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [dto.email],
    );

    // Generate tokens
    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantSchema: tenant.schemaName,
      role: user.role,
      permissions: user.permissions,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // Find tenant
    const tenant = await this.tenantService.findBySlug(dto.tenantSlug);
    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Find user in tenant schema with role
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.status,
              r.name as role, r.permissions
       FROM "${tenant.schemaName}".users u
       LEFT JOIN "${tenant.schemaName}".roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [dto.email],
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.dataSource.query(
      `UPDATE "${tenant.schemaName}".users SET last_login_at = NOW() WHERE id = $1`,
      [user.id],
    );

    // Generate tokens
    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantSchema: tenant.schemaName,
      role: user.role || 'user',
      permissions: user.permissions || {},
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      ...tokens,
    };
  }

  private generateTokens(payload: JwtPayload) {
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }
}