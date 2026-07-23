import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Transform, Type } from "class-transformer";

// @IsOptional() only skips validation for null/undefined, not "" -- without
// this, an empty string from an unfilled optional URL field still hits
// @IsUrl() and fails, which is exactly what broke campaign creation whenever
// the image/icon fields were left blank.
const emptyStringToNull = Transform(({ value }) => (typeof value === "string" && value.trim() === "" ? null : value));

const CAMPAIGN_TYPES = ["instant", "scheduled", "recurring"] as const;
const CAMPAIGN_CHANNELS = ["web", "mobile", "all"] as const;

class CampaignButtonDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsUrl({ require_tld: false })
  url!: string;
}

class CampaignVariantDto {
  @IsString() @MinLength(1) @MaxLength(50) @Matches(/^[a-z0-9][a-z0-9-]*$/) id!: string;
  @IsString() @MinLength(2) title!: string;
  @IsString() @MinLength(2) message!: string;
  @IsUrl({ require_tld: false }) url!: string;
  @IsInt() @Min(1) @Max(10_000) weight!: number;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsUUID()
  segmentId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_CHANNELS)
  channel?: (typeof CAMPAIGN_CHANNELS)[number];

  @IsOptional()
  @IsIn(CAMPAIGN_TYPES)
  type?: (typeof CAMPAIGN_TYPES)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  contentType?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  message?: string;

  @IsOptional()
  @emptyStringToNull
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @emptyStringToNull
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsOptional()
  @IsUUID()
  imageAssetId?: string | null;

  @IsOptional()
  @emptyStringToNull
  @IsUrl({ require_tld: false })
  iconUrl?: string | null;

  @IsOptional()
  @IsUUID()
  iconAssetId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignButtonDto)
  buttons?: CampaignButtonDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique((variant: CampaignVariantDto) => variant.id)
  @ValidateNested({ each: true })
  @Type(() => CampaignVariantDto)
  abVariants?: CampaignVariantDto[];

  @IsOptional()
  @IsString()
  expirationAt?: string | null;

  @IsOptional()
  @IsIn(["draft", "scheduled", "sending", "sent", "failed", "expired"])
  status?: "draft" | "scheduled" | "sending" | "sent" | "failed" | "expired";

  @IsOptional()
  @IsString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsIn(["daily", "weekly", "monthly"])
  recurrenceType?: "daily" | "weekly" | "monthly" | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceInterval?: number | null;

  @IsOptional()
  @IsString()
  recurrenceUntilAt?: string | null;
}
