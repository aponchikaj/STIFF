import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { UserRole } from '../user.entity';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain letters, numbers and underscores',
  })
  username?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class ListUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: UserRole;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  blocked?: boolean;
}

export class BlockUserDto {
  @IsBoolean()
  blocked: boolean;
}

export class ChangeRoleDto {
  @IsIn(['user', 'admin'])
  role: UserRole;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;
}

export class MyReactionsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['like', 'dislike'])
  type?: 'like' | 'dislike';
}
