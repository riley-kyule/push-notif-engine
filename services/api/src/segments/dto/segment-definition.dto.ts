import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";

const SEGMENT_FIELDS = ["country", "browser", "deviceType", "language", "status", "lastSeenAt"] as const;
const SEGMENT_OPERATORS = ["is", "isNot", "in", "notIn", "withinDays", "olderThanDays"] as const;
const SEGMENT_MATCH_MODES = ["all", "any"] as const;

export class SegmentRuleDto {
  @IsIn(SEGMENT_FIELDS)
  field!: (typeof SEGMENT_FIELDS)[number];

  @IsIn(SEGMENT_OPERATORS)
  operator!: (typeof SEGMENT_OPERATORS)[number];

  @IsOptional()
  value?: unknown;
}

export class SegmentDefinitionDto {
  @IsOptional()
  @IsIn(SEGMENT_MATCH_MODES)
  matchMode?: (typeof SEGMENT_MATCH_MODES)[number];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleDto)
  rules!: SegmentRuleDto[];
}
