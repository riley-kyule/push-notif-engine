import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

const SEGMENT_STATUSES = ["active", "archived"] as const;

export class ListSegmentsQueryDto {
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsIn(SEGMENT_STATUSES)
  status?: (typeof SEGMENT_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
