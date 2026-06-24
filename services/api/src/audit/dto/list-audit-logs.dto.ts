import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const SORT_DIRECTIONS = ["asc", "desc"] as const;

export class ListAuditLogsDto {
  // The part of the action before the dot, e.g. "site" matches
  // site.created/site.updated/site.deleted/... -- not a single exact action.
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  actorRole?: string;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  createdAfter?: string;

  @IsOptional()
  @IsString()
  createdBefore?: string;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDir?: (typeof SORT_DIRECTIONS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 25;
}
