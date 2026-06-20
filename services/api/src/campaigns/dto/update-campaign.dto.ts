import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

const CAMPAIGN_TYPES = ["instant", "scheduled", "recurring"] as const;
const CAMPAIGN_CHANNELS = ["web", "mobile", "all"] as const;
const CAMPAIGN_CONTENT_TYPES = ["announcement", "promotion", "editorial", "digest", "alert"] as const;

class CampaignButtonDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsUrl({ require_tld: false })
  url!: string;
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
  @IsIn(CAMPAIGN_CONTENT_TYPES)
  contentType?: (typeof CAMPAIGN_CONTENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  message?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  iconUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignButtonDto)
  buttons?: CampaignButtonDto[];

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
