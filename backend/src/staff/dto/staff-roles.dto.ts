import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  STAFF_PERMISSION_KEYS,
  type StaffPermission,
} from '../staff.constants';

export class CreateStaffRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(STAFF_PERMISSION_KEYS, { each: true })
  permissions?: StaffPermission[];
}

export class UpdateStaffRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(STAFF_PERMISSION_KEYS, { each: true })
  permissions?: StaffPermission[];
}

export class ChangeStaffRoleDto {
  @IsUUID()
  roleId: string;
}

export class BlockStaffUserDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  blocked?: boolean;
}
