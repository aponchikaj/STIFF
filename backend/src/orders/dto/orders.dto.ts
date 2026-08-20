import { Type } from 'class-transformer';
import {
  IsEmail,
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
import { PAYMENT_METHODS, SHIPPING_METHODS } from '../checkout.constants';

export class ShippingAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

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

  @IsIn([...SHIPPING_METHODS])
  shippingMethod: (typeof SHIPPING_METHODS)[number];

  @IsIn([...PAYMENT_METHODS])
  paymentMethod: (typeof PAYMENT_METHODS)[number];

  /**
   * Required when nobody is signed in — it is the only way to send the invoice
   * and the only handle the buyer has on the order. Ignored for signed-in
   * buyers, whose account email is used instead.
   */
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;
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
  @IsIn(['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled'])
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
  @IsIn(['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled'])
  status: OrderStatus;
}

export class UpdateOrderDateDto {
  /** New order date, YYYY-MM-DD (time of day is preserved at noon). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}

export class UpdateTrackingDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  trackingCarrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;

  /** The carrier's own page. Replaces the generic link in status emails. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;
}
