import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

// @IsOptional() only skips validation for null/undefined, not "" -- without
// this, an empty string from an unset optional URL field still hits
// @IsUrl() and fails. Mirrors the same fix in CreateCampaignDto.
const emptyStringToNull = Transform(({ value }) => (typeof value === "string" && value.trim() === "" ? null : value));

// Caps are tighter than the dashboard's CreateCampaignDto (which has none) --
// an external caller can't be walked back from a typo or a buggy template
// the way an admin previewing in the dashboard can, so bound the payload to
// what a browser notification can actually render.
export class SendRestApiNotificationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  body!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @emptyStringToNull
  @IsUrl({ require_tld: false })
  icon?: string | null;

  @IsOptional()
  @emptyStringToNull
  @IsUrl({ require_tld: false })
  image?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  callbackUrl?: string | null;
}
