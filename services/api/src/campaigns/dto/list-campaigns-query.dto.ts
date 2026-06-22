import { IsIn, IsOptional, IsString, IsInt, Max, Min } from "class-validator";
import type { CampaignContentType, CampaignStatus, CampaignType } from "../campaigns.types";

const CAMPAIGN_TYPES = ["instant", "scheduled", "recurring"] as const;
const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "failed", "expired"] as const;
const CAMPAIGN_CONTENT_TYPES = ["announcement", "promotion", "editorial", "digest", "alert"] as const;

export class ListCampaignsQueryDto {
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_TYPES)
  type?: CampaignType;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatus;

  @IsOptional()
  @IsIn(CAMPAIGN_CONTENT_TYPES)
  contentType?: CampaignContentType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
