import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ClearInactiveSubscribersDto {
  // Omitted or null means every site. An explicitly empty array is rejected
  // (ArrayMinSize) rather than silently matching every site -- a caller
  // that means "no sites selected" should not accidentally clear everyone.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  siteIds?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  inactiveSinceDays!: number;
}
