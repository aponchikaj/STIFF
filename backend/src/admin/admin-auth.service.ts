import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AdminLoginDto } from './dto/admin-login.dto';

/**
 * A bcrypt hash of a value nobody knows, compared against when the account
 * does not exist. Without it, "no such user" returns in ~1ms while a real
 * account takes ~100ms, and that gap alone enumerates admin usernames.
 */
const DUMMY_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Signs in at admin.stiff.ge.
   *
   * Every rejection is the same message and the same shape. "Not an admin" is
   * the one that matters: telling a correct-password non-admin that their
   * credentials were fine and only the role was missing would confirm both the
   * account and the password to anyone spraying the shop's user list.
   */
  async login(dto: AdminLoginDto, ip: string | null): Promise<User> {
    const user = await this.usersService.findWithHashByEmailOrUsername(
      dto.emailOrUsername,
    );

    // Always spend the bcrypt round, even with nothing to compare against.
    const ok = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (
      !user ||
      !ok ||
      user.role !== 'admin' ||
      user.isBlocked ||
      !user.isVerified
    ) {
      // The console is the only place the distinction is safe to record.
      this.logger.warn(
        `Rejected admin sign-in for "${dto.emailOrUsername}" from ${ip ?? 'unknown'}` +
          ` (${!user ? 'no account' : !ok ? 'bad password' : user.isBlocked ? 'blocked' : user.role !== 'admin' ? 'not an admin' : 'unverified'})`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Admin sign-in: ${user.email} from ${ip ?? 'unknown'}`);
    return user;
  }
}
