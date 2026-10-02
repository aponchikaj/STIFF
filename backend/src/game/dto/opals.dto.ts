import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  OPAL_ORDER_STATUSES,
  OPAL_PACK_STATUSES,
  OPAL_PAYMENT_METHODS,
  type OpalOrderStatus,
  type OpalPackStatus,
  type OpalPaymentMethod,
} from '../entities';

/**
 * Bounds that stop a typo becoming a price.
 *
 * 1,000,000 opals and 10,000 GEL are far past anything a pack should be,
 * and far short of what overflows an int — a fat-fingered extra zero is
 * refused instead of published.
 */
const MAX_PACK_OPALS = 1_000_000;
const MAX_PACK_PRICE_CENTS = 1_000_000;

export class OpalCheckoutDto {
  @IsUUID()
  packId: string;

  @IsIn([...OPAL_PAYMENT_METHODS])
  method: OpalPaymentMethod;
}

export class CreateOpalPackDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PACK_OPALS)
  opals: number;

  /** Tetri. 500 is 5.00 GEL. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PACK_PRICE_CENTS)
  priceCents: number;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  badge?: string;

  @IsOptional()
  @IsIn([...OPAL_PACK_STATUSES])
  status?: OpalPackStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  sortOrder?: number;
}

export class UpdateOpalPackDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PACK_OPALS)
  opals?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PACK_PRICE_CENTS)
  priceCents?: number;

  /** Send null or an empty string to remove it. */
  @IsOptional()
  @IsString()
  @MaxLength(24)
  badge?: string | null;

  @IsOptional()
  @IsIn([...OPAL_PACK_STATUSES])
  status?: OpalPackStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  sortOrder?: number;
}

export class ListOpalPacksQueryDto {
  @IsOptional()
  @IsIn([...OPAL_PACK_STATUSES])
  status?: OpalPackStatus;
}

export class ListOpalOrdersQueryDto {
  @IsOptional()
  @IsIn([...OPAL_ORDER_STATUSES])
  status?: OpalOrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
