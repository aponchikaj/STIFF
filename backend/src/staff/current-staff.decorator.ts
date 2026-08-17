import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { StaffRequest } from './staff-request';
import type { StaffUser } from './entities/staff-user.entity';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffUser | undefined => {
    const request = ctx.switchToHttp().getRequest<StaffRequest>();
    return request.staffUser;
  },
);
