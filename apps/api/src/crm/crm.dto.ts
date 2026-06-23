import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { DealStage } from '@cadence/shared-types';

export class OrganizationDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() vatNumber?: string;
}

export class ContactDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsOptional() @IsString() lastName?: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() organizationId?: string;
}

export class DealDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsEnum(DealStage) stage?: DealStage;
  @IsOptional() @IsInt() @Min(0) valueCents?: number;
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsString() contactId?: string;
}

export class MoveDealDto {
  @IsEnum(DealStage) stage!: DealStage;
  @IsInt() @Min(0) position!: number;
}

export class ActivityDto {
  @IsEnum(['note', 'task', 'call', 'email', 'meeting']) type!: string;
  @IsString() @MaxLength(200) subject!: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() dealId?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @Type(() => Date) dueAt?: Date;
}

export class TagDto {
  @IsString() @MaxLength(50) name!: string;
  @IsOptional() @IsString() color?: string;
}
