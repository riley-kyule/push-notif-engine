import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

const MOBILE_PLATFORMS = ["ios", "android", "all"] as const;

export class CreateMobilePushDispatchDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsIn(MOBILE_PLATFORMS)
  platform!: (typeof MOBILE_PLATFORMS)[number];

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  body!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsString()
  image?: string | null;
}
