import { Body, Controller, Post } from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";

import { WorkflowService } from "./workflow.service";

class TrackWorkflowEventDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsIn(["page_visit", "api_event"])
  triggerEvent!: "page_visit" | "api_event";

  @IsOptional()
  @IsString()
  subscriberId?: string | null;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

// Public ingestion endpoint for client-side/site-side event reporting (page views from
// the WordPress SDK, custom events from the site's own backend). Rate limited by the
// global Redis-backed guard, like subscriber registration. Distinct from the
// dashboard-only authenticated /workflow/events endpoint.
@Controller("workflow")
export class PublicWorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post("track")
  async track(@Body() dto: TrackWorkflowEventDto): Promise<{ success: true; data: unknown }> {
    const event = await this.workflowService.recordEvent({
      siteId: dto.siteId,
      subscriberId: dto.subscriberId ?? null,
      campaignId: null,
      triggerEvent: dto.triggerEvent,
      payload: dto.payload ?? {},
    });
    return { success: true, data: event };
  }
}
