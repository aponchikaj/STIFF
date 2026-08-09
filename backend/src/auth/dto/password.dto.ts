import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(1)
  token: string;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string;
}
