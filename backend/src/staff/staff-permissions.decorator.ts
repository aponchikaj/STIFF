import { SetMetadata } from '@nestjs/common';
import type { StaffPermission } from './staff.constants';

export const STAFF_PERMISSIONS_KEY = 'staffPermissions';
export const StaffPermissions = (...permissions: StaffPermission[]) =>
  SetMetadata(STAFF_PERMISSIONS_KEY, permissions);
