import type { Request } from 'express';
import type { StaffUser } from './entities/staff-user.entity';

export interface StaffRequest extends Request {
  staffUser?: StaffUser;
  cookies: Record<string, string | undefined>;
}
