import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

const SUBSCRIBER_STATUSES = ["active", "inactive", "unsubscribed", "expired"] as const;

export class RegisterSubscriberDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsString()
  @MinLength(2)
  browser!: string;

  @IsString()
  @MinLength(2)
  deviceType!: string;

  // Country is optional — the browser SDK cannot determine country without geolocation.
  // The controller falls back to the cf-ipcountry header (see geo-ip.util.ts); 'Unknown' is the final fallback.
  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  @MinLength(2)
  language!: string;

  @IsUrl({ require_tld: false })
  subscriptionEndpoint!: string;

  @IsOptional()
  @IsString()
  p256dhKey?: string | null;

  @IsOptional()
  @IsString()
  authKey?: string | null;

  @IsOptional()
  @IsIn(SUBSCRIBER_STATUSES)
  status?: (typeof SUBSCRIBER_STATUSES)[number];
}
