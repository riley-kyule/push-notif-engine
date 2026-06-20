import { Type } from "class-transformer";
import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUrl, MinLength, ValidateNested } from "class-validator";

const AUTOMATION_ACTION_TYPES = ["send_notification", "add_tag", "remove_tag", "webhook"] as const;
const WEBHOOK_METHODS = ["POST", "PUT", "PATCH"] as const;

class AutomationButtonDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsUrl({ require_tld: false })
  url!: string;
}

export class AutomationActionDto {
  @IsIn(AUTOMATION_ACTION_TYPES)
  type!: (typeof AUTOMATION_ACTION_TYPES)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
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
  @IsString()
  @MinLength(1)
  tag?: string;

  @IsOptional()
  @IsIn(WEBHOOK_METHODS)
  method?: (typeof WEBHOOK_METHODS)[number];

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
