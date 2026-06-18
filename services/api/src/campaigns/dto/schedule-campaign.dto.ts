import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class ScheduleCampaignDto {
  @IsOptional()
  @IsString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsIn(["daily", "weekly", "monthly"])
  recurrenceType?: "daily" | "weekly" | "monthly" | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceInterval?: number | null;

  @IsOptional()
  @IsString()
  recurrenceUntilAt?: string | null;
}
