import { IsArray, IsIn, IsOptional, IsString, IsUrl, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

const AUTOMATION_TRIGGER_EVENTS = ["subscriber_registered"] as const;
const AUTOMATION_STATUSES = ["active", "paused"] as const;

class AutomationButtonDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsUrl({ require_tld: false })
  url!: string;
}

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(AUTOMATION_TRIGGER_EVENTS)
  triggerEvent?: (typeof AUTOMATION_TRIGGER_EVENTS)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  message?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  iconUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationButtonDto)
  buttons?: AutomationButtonDto[];

  @IsOptional()
  @IsIn(AUTOMATION_STATUSES)
  status?: (typeof AUTOMATION_STATUSES)[number];
}
