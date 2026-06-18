import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

const SITE_STATUSES = ["active", "inactive"] as const;
const SITE_PLATFORMS = ["WordPress", "Magento", "Node.js", "Laravel", "Other"] as const;

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  language?: string;

  @IsOptional()
  @IsIn(SITE_PLATFORMS)
  platform?: (typeof SITE_PLATFORMS)[number];

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  vapidSubject?: string | null;

  @IsOptional()
  @IsString()
  vapidPublicKey?: string | null;

  @IsOptional()
  @IsString()
  vapidPrivateKey?: string | null;

  @IsOptional()
  @IsIn(SITE_STATUSES)
  status?: (typeof SITE_STATUSES)[number];
}
