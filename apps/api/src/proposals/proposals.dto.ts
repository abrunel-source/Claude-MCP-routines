import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class ComposeProposalDto {
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(150) prospectName!: string;
  @IsEmail() prospectEmail!: string;
  @IsString() coverLetterId!: string;
  @IsString() termsTemplateId!: string;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) packageIds!: string[];
  @IsOptional() @IsString() dealId?: string;
  @IsOptional() @IsInt() @Min(0) upfrontAmountCents?: number;
}

export class SelectPackageDto {
  @IsString() optionId!: string;
}

export class SignDto {
  @IsString() @MaxLength(150) signerName!: string;
  @IsEmail() signerEmail!: string;
  @IsOptional() @IsString() method?: 'typed' | 'drawn';
  @IsString() signatureData!: string;
  @IsBoolean() consent!: boolean;
}
