import { IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import { Transform } from "class-transformer";

// @IsOptional() only skips validation for null/undefined, not "" -- without
// this, an empty string from an unset optional URL field still hits
// @IsUrl() and fails. Mirrors the same fix in CreateCampaignDto.
const emptyStringToNull = Transform(({ value }) => (typeof value === "string" && value.trim() === "" ? null : value));

export class SendRestApiNotificationDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
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
}
