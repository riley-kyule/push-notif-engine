import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const SITE_STATUSES = ["active", "inactive"] as const;
const SITE_SORT_FIELDS = ["name", "createdAt", "subscriberCount", "connection", "country"] as const;
const SORT_DIRECTIONS = ["asc", "desc"] as const;

export class ListSitesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(SITE_STATUSES)
  status?: (typeof SITE_STATUSES)[number];

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(SITE_SORT_FIELDS)
  sortBy?: (typeof SITE_SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDir?: (typeof SORT_DIRECTIONS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
