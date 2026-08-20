import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  /**
   * The exact row to buy. Authoritative when present.
   *
   * Preferred over (size, color): the variant *is* the buyable unit, so
   * sending its id removes a lookup that can resolve to the wrong colourway
   * when two of them share a size label.
   */
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  /** Ignored when `variantId` is given. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}
