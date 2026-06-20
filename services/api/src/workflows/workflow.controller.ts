import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkflowService } from "./workflow.service";

class RecordWorkflowEventDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsIn(["subscriber_registered", "page_visit", "click", "api_event", "rss_item_published"])
  triggerEvent!: "subscriber_registered" | "page_visit" | "click" | "api_event" | "rss_item_published";

  @IsOptional()
  @IsString()
  subscriberId?: string | null;

  @IsOptional()
  @IsString()
  campaignId?: string | null;

  @IsOptional()
  payload?: Record<string, unknown>;
}

class ListWorkflowEventsQueryDto {
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsIn(["pending", "completed", "failed"])
  status?: "pending" | "completed" | "failed";
}

class CreateRssFeedDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsUrl({ require_tld: false })
  feedUrl!: string;
}

class UpdateRssFeedDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  feedUrl?: string;

  @IsOptional()
  @IsIn(["active", "paused"])
  status?: "active" | "paused";
}

@Controller("workflow")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "editor", "analyst")
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post("events")
  async recordEvent(@Body() dto: RecordWorkflowEventDto): Promise<{ success: true; data: unknown }> {
    const event = await this.workflowService.recordEvent({
      siteId: dto.siteId,
      subscriberId: dto.subscriberId ?? null,
      campaignId: dto.campaignId ?? null,
      triggerEvent: dto.triggerEvent,
      payload: dto.payload ?? {},
    });
    return { success: true, data: event };
  }

  @Get("events")
  async listEvents(@Query() query: ListWorkflowEventsQueryDto): Promise<{ success: true; data: unknown }> {
    const filters: { siteId?: string; status?: "pending" | "completed" | "failed"; limit: number; offset: number } = {
      limit: 25,
      offset: 0,
    };
    if (query.siteId) {
      filters.siteId = query.siteId;
    }
    if (query.status) {
      filters.status = query.status;
    }

    const result = await this.workflowService.listEvents(filters);
    return { success: true, data: result };
  }

  @Get("rss-feeds")
  async listFeeds(@Query("siteId") siteId?: string): Promise<{ success: true; data: unknown }> {
    const result = await this.workflowService.listRssFeeds(siteId ? { siteId, limit: 50, offset: 0 } : { limit: 50, offset: 0 });
    return { success: true, data: result };
  }

  @Post("rss-feeds")
  async createFeed(@Body() dto: CreateRssFeedDto): Promise<{ success: true; data: unknown }> {
    const feed = await this.workflowService.createRssFeed({
      siteId: dto.siteId,
      name: dto.name,
      feedUrl: dto.feedUrl,
      status: "active",
    });
    return { success: true, data: feed };
  }

  @Get("rss-feeds/:id")
  async getFeed(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const feed = await this.workflowService.getRssFeed(id);
    return { success: true, data: feed };
  }

  @Patch("rss-feeds/:id")
  async updateFeed(@Param("id") id: string, @Body() dto: UpdateRssFeedDto): Promise<{ success: true; data: unknown }> {
    const feed = await this.workflowService.updateRssFeed(id, dto);
    return { success: true, data: feed };
  }

  @Delete("rss-feeds/:id")
  async deleteFeed(@Param("id") id: string): Promise<{ success: true; data: { deleted: true } }> {
    await this.workflowService.deleteRssFeed(id);
    return { success: true, data: { deleted: true } };
  }

  @Post("rss-feeds/:id/poll")
  async pollFeed(@Param("id") id: string): Promise<{ success: true; data: { polled: true } }> {
    const feed = await this.workflowService.getRssFeed(id);
    await this.workflowService.pollFeed(feed);
    return { success: true, data: { polled: true } };
  }
}
