import { IsIn, IsString, MinLength } from "class-validator";

const MOBILE_PLATFORMS = ["ios", "android"] as const;

export class RefreshMobileDeviceDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsIn(MOBILE_PLATFORMS)
  platform!: (typeof MOBILE_PLATFORMS)[number];

  @IsString()
  @MinLength(8)
  currentDeviceToken!: string;

  @IsString()
  @MinLength(8)
  nextDeviceToken!: string;
}
