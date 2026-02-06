import { SetMetadata } from '@nestjs/common';
import { RequiredPermission, PERMISSIONS_KEY } from '../guards/permissions.guard';

export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);