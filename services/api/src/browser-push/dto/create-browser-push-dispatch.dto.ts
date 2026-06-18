import { IsOptional, IsString, IsUUID, IsUrl, MinLength } from "class-validator";

export class CreateBrowserPushDispatchDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

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

  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @IsOptional()
  @IsUUID()
  segmentId?: string | null;
}
