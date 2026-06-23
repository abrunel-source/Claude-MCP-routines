import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PlanTier, Role } from '@cadence/shared-types';

export class SignupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  companyName!: string;

  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/, {
    message: 'slug must be 3-40 lowercase letters, digits or hyphens',
  })
  slug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10, { message: 'password must be at least 10 characters' })
  @MaxLength(200)
  password!: string;

  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEnum(PlanTier) planTier?: PlanTier;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

export class InviteDto {
  @IsEmail() email!: string;
  @IsEnum(Role) role!: Role;
}

export class AcceptInviteDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) password!: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
}

export class RequestPasswordResetDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) password!: string;
}

export class VerifyEmailDto {
  @IsString() token!: string;
}
