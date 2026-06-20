import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AnalyticsService } from "./analytics.service";

interface CsvResponseLike {
  setHeader(name: string, value: string): void;
}

@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "editor", "analyst")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  async getOverview(@Query("days") days?: string): Promise<{ success: true; data: unknown }> {
    const overview = await this.analyticsService.getOverview(days ? parseInt(days, 10) : 30);
    return { success: true, data: overview };
  }

  @Get("campaigns/:campaignId")
  async getCampaignStats(
    @Param("campaignId") campaignId: string,
  ): Promise<{ success: true; data: unknown }> {
    const stats = await this.analyticsService.getCampaignStats(campaignId);
    return { success: true, data: stats };
  }

  @Get("sites/:siteId")
  async getSiteOverview(
    @Param("siteId") siteId: string,
    @Query("days") days?: string,
  ): Promise<{ success: true; data: unknown }> {
    const overview = await this.analyticsService.getSiteOverview(siteId, days ? parseInt(days, 10) : 30);
    return { success: true, data: overview };
  }

  @Get("sites/:siteId/subscriber-growth")
  async getSubscriberGrowth(
    @Param("siteId") siteId: string,
    @Query("days") days?: string,
  ): Promise<{ success: true; data: unknown }> {
    const growth = await this.analyticsService.getSubscriberGrowth(siteId, days ? parseInt(days, 10) : 30);
    return { success: true, data: growth };
  }

  @Get("countries")
  async getCountryPerformance(@Query("days") days?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getCountryPerformance(days ? parseInt(days, 10) : 30);
    return { success: true, data: performance };
  }

  @Get("sites-performance")
  async getSitePerformance(@Query("days") days?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getSitePerformance(days ? parseInt(days, 10) : 30);
    return { success: true, data: performance };
  }

  @Get("time-performance")
  async getTimePerformance(@Query("days") days?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getTimePerformance(days ? parseInt(days, 10) : 30);
    return { success: true, data: performance };
  }

  @Get("content-performance")
  async getContentPerformance(@Query("days") days?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getContentPerformance(days ? parseInt(days, 10) : 30);
    return { success: true, data: performance };
  }

  @Get("export")
  async exportReport(
    @Res({ passthrough: true }) response: CsvResponseLike,
    @Query("days") days?: string,
    @Query("report") report?: "overview" | "countries" | "sites-performance" | "time-performance" | "content-performance",
  ): Promise<string> {
    const result = await this.analyticsService.exportReport({
      days: days ? parseInt(days, 10) : 30,
      report: report ?? "overview",
    });

    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader("content-disposition", `attachment; filename="${result.filename}"`);
    return result.csv;
  }
}
