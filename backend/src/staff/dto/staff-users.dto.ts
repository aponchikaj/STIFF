import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @MinLength(1)
  emailOrUsername: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class CreateStaffUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain letters, numbers and underscores',
  })
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^@?[A-Za-z0-9._]+$/, {
    message:
      'instagram username can only contain letters, numbers, periods and underscores',
  })
  instagramUsername: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class ChangeStaffPasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class UpdateStaffProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain letters, numbers and underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^@?[A-Za-z0-9._]+$/, {
    message:
      'instagram username can only contain letters, numbers, periods and underscores',
  })
  instagramUsername?: string;
}
