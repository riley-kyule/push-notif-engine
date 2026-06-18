import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const SUBSCRIBER_STATUSES = ["active", "inactive", "unsubscribed", "expired"] as const;

export class ListSubscribersQueryDto {
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(SUBSCRIBER_STATUSES)
  status?: (typeof SUBSCRIBER_STATUSES)[number];

  @IsOptional()
  @IsString()
  browser?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
