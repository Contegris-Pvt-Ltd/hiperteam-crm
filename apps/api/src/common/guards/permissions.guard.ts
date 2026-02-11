import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { ModuleAction, hasPermission } from '../types/permissions.types';

// ============================================================
// METADATA KEYS
// ============================================================
export const PERMISSION_KEY = 'required_permission';
export const ADMIN_ONLY_KEY = 'admin_only';

// ============================================================
// DECORATORS
// ============================================================

/**
 * @RequirePermission('contacts', 'edit')
 * Requires the user to have a specific module-level permission.
 */
export const RequirePermission = (module: string, action: ModuleAction) =>
  SetMetadata(PERMISSION_KEY, { module, action });

/**
 * @AdminOnly()
 * Restricts endpoint to admin role only.
 */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

// ============================================================
// GUARD
// ============================================================

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check admin-only
    const isAdminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isAdminOnly) {
      if (user.role !== 'admin' && user.roleLevel < 100) {
        throw new ForbiddenException('Admin access required');
      }
      return true;
    }

    // Check module-level permission
    const requiredPermission = this.reflector.getAllAndOverride<{
      module: string;
      action: ModuleAction;
    }>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermission) {
      // No permission decorator → allow (guard only enforces when decorator is present)
      return true;
    }

    const { module, action } = requiredPermission;

    if (!hasPermission(user.permissions || {}, module, action)) {
      throw new ForbiddenException(
        `You don't have permission to ${action} ${module}`,
      );
    }

    return true;
  }
}