import { IsIn, IsString, IsUrl, MinLength } from "class-validator";

const MOBILE_PLATFORMS = ["ios", "android"] as const;

export class PublicRecordMobileClickDto {
  @IsIn(MOBILE_PLATFORMS)
  platform!: (typeof MOBILE_PLATFORMS)[number];

  @IsString()
  @MinLength(8)
  deviceToken!: string;

  @IsUrl({ require_tld: false })
  destinationUrl!: string;
}
