import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class NamedBodyDto {
  @IsString() @MaxLength(150) name!: string;
  @IsString() body!: string;
}

export class ServiceDto {
  @IsString() @MaxLength(150) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) defaultPriceCents!: number;
  @IsOptional() @IsString() pricingType?: string;
  @IsOptional() @IsString() recurringInterval?: string;
  @IsOptional() @IsString() taxMode?: string;
}

export class PackageItemDto {
  @IsString() name!: string;
  @IsOptional() @IsString() serviceId?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsInt() @Min(0) unitPriceCents!: number;
  @IsOptional() @IsString() taxMode?: string;
}

export class ServicePackageDto {
  @IsString() @MaxLength(150) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isRecurring?: boolean;
  @IsOptional() @IsString() recurringInterval?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PackageItemDto) items!: PackageItemDto[];
}
