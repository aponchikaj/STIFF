import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RETURN_STATUSES, type ReturnStatus } from '../return-request.entity';

export class ReturnLineDto {
  @IsUUID()
  orderItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items: ReturnLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ResolveReturnDto {
  @IsIn([...RETURN_STATUSES])
  status: ReturnStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  refundCents?: number;
}

export class ListReturnsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([...RETURN_STATUSES])
  status?: ReturnStatus;
}
