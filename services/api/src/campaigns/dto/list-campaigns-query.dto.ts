import { IsIn, IsOptional, IsString, IsInt, Min } from "class-validator";
import type { CampaignStatus, CampaignType } from "../campaigns.types";

const CAMPAIGN_TYPES = ["instant", "scheduled", "recurring"] as const;
const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "failed", "expired"] as const;

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
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
