import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreditInputDto } from './shoot.dto';

/**
 * A piece worn in a shot, and optionally where on the frame it is worn.
 *
 * Coordinates are percentages of the displayed frame, after `rotation`. Both
 * or neither: half a pin is not a pin, which is what
 * `CHK_gallery_item_products_hotspot` enforces at the other end.
 */
export class ProductTagDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  hotspotX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  hotspotY?: number;
}

/**
 * Fields shared by create and update: what a shot belongs to and what is in
 * it, as opposed to what it looks like.
 */
export class GalleryLinksDto {
  /**
   * The pieces worn in this shot, with their pins.
   *
   * Supersedes `productIds` when both are sent. Absent leaves the links
   * alone; an empty array clears them.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductTagDto)
  productTags?: ProductTagDto[];

  /** The shoot this frame came out of. Null detaches it. */
  @IsOptional()
  @IsUUID()
  shootId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  tagIds?: string[];

  /** Credits specific to this frame, on top of the shoot's. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreditInputDto)
  credits?: CreditInputDto[];
}

export class CreateGalleryItemDto extends GalleryLinksDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  // Optional override for the stable URL slug. If omitted, the service uses
  // `title` (preserving the previous behavior where title==slug).
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @IsString()
  @MinLength(1)
  imageUrl: string;

  /**
   * The pieces worn in this shot.
   *
   * Absent leaves the links alone; an empty array clears them — the usual
   * distinction between "not mentioned" and "set to nothing".
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  productIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 90, 180, 270])
  rotation?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateGalleryItemDto extends GalleryLinksDto {
  /**
   * The pieces worn in this shot.
   *
   * Absent leaves the links alone; an empty array clears them — the usual
   * distinction between "not mentioned" and "set to nothing".
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  productIds?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  // Updating slug is allowed (admin flow), but it must remain unique.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 90, 180, 270])
  rotation?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

/**
 * One shot in a bulk upload. Unlike a single create, the title is optional —
 * a dropped folder of files gets its numbering from the archive instead of
 * from whoever is uploading.
 */
export class BulkGalleryItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @IsString()
  @MinLength(1)
  imageUrl: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 90, 180, 270])
  rotation?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

/**
 * The admin panel uploads files first and then posts the resulting URLs as a
 * batch, so a dropped folder of twenty images is one request, not twenty.
 */
export class BulkCreateGalleryItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkGalleryItemDto)
  items: BulkGalleryItemDto[];
}

export class ReorderEntryDto {
  @IsUUID()
  id: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderGalleryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  items: ReorderEntryDto[];
}

export class ListGalleryQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['newest', 'popular'])
  sort?: 'newest' | 'popular';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;

  /** Tag slug. Repeat the parameter to narrow across axes: season *and* place. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? [value] : value,
  )
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  tag?: string[];

  /** Shoot slug. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shoot?: string;

  /**
   * Keyset position, from a previous page's `nextCursor`.
   *
   * Supersedes `page` when present. Anything unreadable is ignored rather
   * than rejected, so a stale bookmark starts the archive from the top
   * instead of showing an error.
   */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  cursor?: string;
}
