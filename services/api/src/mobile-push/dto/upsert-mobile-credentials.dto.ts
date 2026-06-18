import { IsOptional, IsString, MinLength } from "class-validator";

export class UpsertMobileCredentialsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  apnsKeyId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  apnsTeamId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  apnsBundleId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  apnsPrivateKey?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fcmProjectId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fcmClientEmail?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fcmPrivateKey?: string | null;
}
