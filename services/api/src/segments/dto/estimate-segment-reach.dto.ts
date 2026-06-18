import { Type } from "class-transformer";
import { IsString, MinLength, ValidateNested } from "class-validator";

import { SegmentDefinitionDto } from "./segment-definition.dto";

export class EstimateSegmentReachDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @ValidateNested()
  @Type(() => SegmentDefinitionDto)
  definition!: SegmentDefinitionDto;
}
