import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

const MOBILE_PLATFORMS = ["ios", "android"] as const;

// Used by the public, site-API-key-authenticated mobile device endpoints — siteId
// comes from the authenticated site (see RestApiAuthGuard), never from the client.
export class PublicRegisterMobileDeviceDto {
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
