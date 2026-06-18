import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

const MOBILE_PLATFORMS = ["ios", "android"] as const;

export class RegisterMobileDeviceDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsIn(MOBILE_PLATFORMS)
  platform!: (typeof MOBILE_PLATFORMS)[number];

  @IsString()
  @MinLength(8)
  deviceToken!: string;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsString()
  language?: string | null;
}
