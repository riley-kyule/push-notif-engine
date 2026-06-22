import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength } from "class-validator";

const SITE_STATUSES = ["active", "inactive"] as const;
const SITE_PLATFORMS = ["WordPress", "Magento", "Node.js", "Laravel", "Other"] as const;
const OPT_IN_PROMPT_TYPES = ["lightbox-1", "lightbox-2", "bell-icon"] as const;
const OPT_IN_PROMPT_ANIMATIONS = ["slide-in", "fade-in", "pop"] as const;

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
  appName?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string | null;

  @IsOptional()
  @IsString()
  themeColor?: string | null;

  @IsOptional()
  @IsIn(OPT_IN_PROMPT_TYPES)
  optInPromptType?: (typeof OPT_IN_PROMPT_TYPES)[number];

  @IsOptional()
  @IsIn(OPT_IN_PROMPT_ANIMATIONS)
  optInPromptAnimation?: (typeof OPT_IN_PROMPT_ANIMATIONS)[number];

  @IsOptional()
  @IsString()
  optInPromptBackgroundColor?: string | null;

  @IsOptional()
  @IsString()
  optInPromptHeadline?: string | null;

  @IsOptional()
  @IsString()
  optInPromptHeadlineTextColor?: string | null;

  @IsOptional()
  @IsString()
  optInPromptText?: string | null;

  @IsOptional()
  @IsString()
  optInPromptTextColor?: string | null;

  @IsOptional()
  @IsString()
  optInPromptIconUrl?: string | null;

  @IsOptional()
  @IsString()
  optInPromptCancelButtonLabel?: string | null;

  @IsOptional()
  @IsString()
  optInPromptCancelButtonTextColor?: string | null;

  @IsOptional()
  @IsString()
  optInPromptCancelButtonBackgroundColor?: string | null;

  @IsOptional()
  @IsString()
  optInPromptApproveButtonLabel?: string | null;

  @IsOptional()
  @IsString()
  optInPromptApproveButtonTextColor?: string | null;

  @IsOptional()
  @IsString()
  optInPromptApproveButtonBackgroundColor?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  optInPromptRepromptDelayDays?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  optInPromptRecentNotificationsLimit?: number | null;

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
