import {
  applyDecorators,
  Controller,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { IS_STAFF_AREA_KEY } from './staff.constants';
import { StaffJwtGuard } from './staff-jwt.guard';
import { StaffPermissionsGuard } from './staff-permissions.guard';

export const StaffArea = () => SetMetadata(IS_STAFF_AREA_KEY, true);

/** Staff HTTP controllers live under /api/staff/* and use staff JWT, not shop. */
export function StaffController(prefix: string) {
  return applyDecorators(
    StaffArea(),
    Controller(`staff/${prefix}`),
    UseGuards(StaffJwtGuard, StaffPermissionsGuard),
  );
}
