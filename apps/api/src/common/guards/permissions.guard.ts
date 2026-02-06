import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface RequiredPermission {
  module: string;
  action: string;
}

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.permissions) {
      throw new ForbiddenException('No permissions found');
    }

    // Admin with wildcard has full access
    if (user.permissions['*']?.['*'] === 'all') {
      return true;
    }

    for (const permission of requiredPermissions) {
      const modulePerms = user.permissions[permission.module];
      
      if (!modulePerms) {
        throw new ForbiddenException(`No access to ${permission.module}`);
      }

      // Check for wildcard action or specific action
      const hasAccess = modulePerms['*'] || modulePerms[permission.action];
      
      if (!hasAccess) {
        throw new ForbiddenException(`No ${permission.action} access to ${permission.module}`);
      }
    }

    return true;
  }
}