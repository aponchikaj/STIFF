import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * One buyable colour-and-size.
 *
 * `size` is empty for a product sold in a single size, `color` for one sold in
 * a single colour — both are labels, not flags, so the same row shape covers a
 * plain tee and a four-colourway jacket.
 */
export class VariantDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  /** `#rrggbb`; anything else is stored as null rather than rejected. */
  @IsOptional()
  @IsString()
  @MaxLength(7)
  colorHex?: string | null;

  /** Photographs of this colourway. Empty falls back to the product's own. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  /** Added to the product price for this size. Negative is allowed. */
  @IsOptional()
  @IsInt()
  priceDeltaCents?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  /** Descriptions of `images`, aligned by index. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  imageAlts?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];

  /**
   * The full set of buyable sizes. When present it replaces `sizes` and
   * `stock` — those two remain only so an older admin build keeps working.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsObject()
  stockBySize?: Record<string, number>;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  /** Descriptions of `images`, aligned by index. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  imageAlts?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];

  /**
   * The full set of buyable sizes. When present it replaces `sizes` and
   * `stock` — those two remain only so an older admin build keeps working.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsObject()
  stockBySize?: Record<string, number>;

  @IsOptional()
  isActive?: boolean;

  /** When the drop opens. Null publishes immediately. */
  @IsOptional()
  @IsISO8601()
  publishAt?: string | null;

  @IsOptional()
  @IsBoolean()
  preorderEnabled?: boolean;

  /** YYYY-MM-DD, shown to the customer as the promised ship date. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preorderShipsAt?: string;

  /** Units sellable beyond real stock. 0 means none. */
  @IsOptional()
  @IsInt()
  @Min(0)
  preorderLimit?: number;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popular';

export class ListProductsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc', 'popular'])
  sort?: ProductSort;
}
