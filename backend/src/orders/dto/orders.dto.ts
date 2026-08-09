import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { OrderStatus } from '../order.entity';

export class ShippingAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  country: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  phone: string;
}

export class CheckoutDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}

export class BuyNowDto extends CheckoutDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;
}

export class ListOrdersQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['pending', 'paid', 'shipped', 'delivered', 'cancelled'])
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  search?: string;

  /** Inclusive start date, YYYY-MM-DD. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** Inclusive end date, YYYY-MM-DD. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(['pending', 'paid', 'shipped', 'delivered', 'cancelled'])
  status: OrderStatus;
}

export class UpdateOrderDateDto {
  /** New order date, YYYY-MM-DD (time of day is preserved at noon). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}
