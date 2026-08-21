import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Where a signup came from. A closed list, so a bad form shows up as a zero. */
export const SUBSCRIBE_SOURCES = [
  'home',
  'footer',
  'checkout',
  'admin',
] as const;

export class SubscribeDto {
  @IsEmail({}, { message: 'That does not look like an email address' })
  @MaxLength(180)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  email: string;

  @IsOptional()
  @IsIn([...SUBSCRIBE_SOURCES])
  source?: (typeof SUBSCRIBE_SOURCES)[number];
}

export class SubscriberTokenDto {
  @IsString()
  @Length(32, 64)
  token: string;
}
