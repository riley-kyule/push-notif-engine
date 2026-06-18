import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

import { SegmentDefinitionDto } from "./segment-definition.dto";

const SEGMENT_STATUSES = ["active", "archived"] as const;

export class UpdateSegmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(SEGMENT_STATUSES)
  status?: (typeof SEGMENT_STATUSES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentDefinitionDto)
  definition?: SegmentDefinitionDto;
}
