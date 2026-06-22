import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

const CAMPAIGN_MEDIA_KINDS = ["image", "icon"] as const;

export class UploadCampaignMediaDto {
  @IsUUID()
  siteId!: string;

  @IsIn(CAMPAIGN_MEDIA_KINDS)
  kind!: (typeof CAMPAIGN_MEDIA_KINDS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  campaignId?: string | null;
}
