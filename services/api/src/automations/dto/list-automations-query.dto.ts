import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { AutomationStatus, AutomationTriggerEvent } from "../automations.types";

const AUTOMATION_TRIGGER_EVENTS = ["subscriber_registered", "page_visit", "click", "api_event", "rss_item_published"] as const;
const AUTOMATION_STATUSES = ["active", "paused"] as const;

export class ListAutomationsQueryDto {
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsIn(AUTOMATION_TRIGGER_EVENTS)
  triggerEvent?: AutomationTriggerEvent;

  @IsOptional()
  @IsIn(AUTOMATION_STATUSES)
  status?: AutomationStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
