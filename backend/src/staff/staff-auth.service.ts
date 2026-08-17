import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { StaffUser } from './entities/staff-user.entity';
import { StaffLoginDto } from './dto/staff-users.dto';
import { StaffUsersService } from './staff-users.service';

@Injectable()
export class StaffAuthService {
  constructor(private readonly staffUsersService: StaffUsersService) {}

  async login(dto: StaffLoginDto): Promise<StaffUser> {
    const user = await this.staffUsersService.findWithHashByEmailOrUsername(
      dto.emailOrUsername,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');
    return user;
  }
}
