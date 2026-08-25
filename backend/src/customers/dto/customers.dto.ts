import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SaveAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

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

  /** One of GEORGIA_REGIONS. Free text so a new region needs no migration. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  /** Optional — Georgian postcodes exist but are widely unused. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  /** Validated and normalised to +995XXXXXXXXX by the service. */
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SubscribeStockDto {
  @IsUUID()
  variantId: string;

  /** Required when nobody is signed in. */
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;
}
