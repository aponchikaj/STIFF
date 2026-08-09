import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SubmitContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;
}

export class ListContactQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  handled?: boolean;
}

export class SetHandledDto {
  @IsBoolean()
  handled: boolean;
}

export class ReplyContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;
}
