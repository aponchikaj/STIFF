import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SendStaffMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;
}

export class OpenDmDto {
  @IsUUID()
  userId: string;
}

export class StaffMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 40;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}
