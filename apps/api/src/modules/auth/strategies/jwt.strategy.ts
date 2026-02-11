import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  ModulePermissions,
  RecordAccess,
  FieldPermissions,
} from '../../../common/types/permissions.types';

/**
 * JWT Payload — carried in every authenticated request.
 * 
 * Contains the 3-level RBAC context:
 *   permissions      → Module-level (what actions)
 *   recordAccess     → Record-level (whose data)
 *   fieldPermissions → Field-level (which fields)
 * 
 * Plus org context:
 *   departmentId → user's department
 *   teamIds      → user's team memberships
 *   managerId    → user's direct manager
 */
export interface JwtPayload {
  // Identity
  sub: string;           // user ID
  email: string;
  tenantId: string;
  tenantSlug: string;
  tenantSchema: string;

  // Role
  role: string;          // role name (admin, manager, user, custom)
  roleId: string;        // role UUID
  roleLevel: number;     // hierarchy level (higher = more powerful)

  // RBAC — Level 1: Module permissions
  permissions: ModulePermissions;

  // RBAC — Level 2: Record access scope
  recordAccess: RecordAccess;

  // RBAC — Level 3: Field permissions
  fieldPermissions: FieldPermissions;

  // Org context
  departmentId?: string;
  teamIds?: string[];
  managerId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'fallback-secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}