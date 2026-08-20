import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const KINDS = ['percent', 'fixed', 'free_shipping'] as const;

export class CreateDiscountDto {
  @IsString()
  @MaxLength(40)
  code: string;

  @IsIn([...KINDS])
  kind: (typeof KINDS)[number];

  /** Percent 1–100, or minor units off. Ignored for free shipping. */
  @IsOptional()
  @IsInt()
  @Min(0)
  value: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSubtotalCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdateDiscountDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number | null;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CreateGiftCardDto {
  /** Omit to have one generated. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsInt()
  @Min(1)
  initialCents: number;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class SetActiveDto {
  @IsBoolean()
  isActive: boolean;
}

/** What the cart asks for when someone types a code. */
export class QuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  discountCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  giftCardCode?: string;

  @IsIn(['pickup', 'tbilisi', 'regions'])
  shippingMethod: 'pickup' | 'tbilisi' | 'regions';

  /** Guests are capped per-email, so a per-user limit works without an account. */
  @IsOptional()
  @IsString()
  @MaxLength(180)
  email?: string;
}
