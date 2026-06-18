import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
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
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
