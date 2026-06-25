import crypto from "node:crypto";

import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AnalyticsService } from "./analytics.service";
import { GoogleSheetsClient } from "./google-sheets.client";
import { isGoogleSheetsExportConfigured } from "./google-sheets.config";

interface CsvResponseLike {
  setHeader(name: string, value: string): void;
}

type ExportReportKey = "overview" | "countries" | "sites-performance" | "time-performance" | "content-performance";

interface GoogleSheetsExportStatePayload {
  report: ExportReportKey;
  days: number;
}

function encodeState(nonce: string, payload: GoogleSheetsExportStatePayload): string {
  return `${nonce}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

function decodeState(state: string): { nonce: string; payload: GoogleSheetsExportStatePayload } {
  const separatorIndex = state.indexOf(".");
  if (separatorIndex === -1) {
    throw new BadRequestException("Malformed OAuth state");
  }

  const nonce = state.slice(0, separatorIndex);
  try {
    const payload = JSON.parse(Buffer.from(state.slice(separatorIndex + 1), "base64url").toString("utf8")) as GoogleSheetsExportStatePayload;
    return { nonce, payload };
  } catch {
    throw new BadRequestException("Malformed OAuth state");
  }
}

@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "sub-admin")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly googleSheetsClient: GoogleSheetsClient,
  ) {}

  @Get("overview")
  async getOverview(@Query("days") days?: string, @Query("siteId") siteId?: string): Promise<{ success: true; data: unknown }> {
    const overview = await this.analyticsService.getOverview(days ? parseInt(days, 10) : 30, siteId);
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
  async getCountryPerformance(@Query("days") days?: string, @Query("siteId") siteId?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getCountryPerformance(days ? parseInt(days, 10) : 30, siteId);
    return { success: true, data: performance };
  }

  @Get("sites-performance")
  async getSitePerformance(@Query("days") days?: string, @Query("siteId") siteId?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getSitePerformance(days ? parseInt(days, 10) : 30, siteId);
    return { success: true, data: performance };
  }

  @Get("time-performance")
  async getTimePerformance(@Query("days") days?: string, @Query("siteId") siteId?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getTimePerformance(days ? parseInt(days, 10) : 30, siteId);
    return { success: true, data: performance };
  }

  @Get("content-performance")
  async getContentPerformance(@Query("days") days?: string, @Query("siteId") siteId?: string): Promise<{ success: true; data: unknown }> {
    const performance = await this.analyticsService.getContentPerformance(days ? parseInt(days, 10) : 30, siteId);
    return { success: true, data: performance };
  }

  @Get("export")
  async exportReport(
    @Res({ passthrough: true }) response: CsvResponseLike,
    @Query("days") days?: string,
    @Query("report") report?: "overview" | "countries" | "sites-performance" | "time-performance" | "content-performance",
    @Query("format") format?: "csv" | "xlsx" | "pdf",
  ): Promise<string | Buffer> {
    const result = await this.analyticsService.exportReport({
      days: days ? parseInt(days, 10) : 30,
      report: report ?? "overview",
      ...(format ? { format } : {}),
    });

    response.setHeader("content-type", result.contentType);
    response.setHeader("content-disposition", `attachment; filename="${result.filename}"`);
    return result.body;
  }

  @Get("export/google-sheets/status")
  getGoogleSheetsExportStatus(): { success: true; data: { configured: boolean } } {
    return { success: true, data: { configured: isGoogleSheetsExportConfigured() } };
  }

  @Get("export/google-sheets/authorize-url")
  getGoogleSheetsAuthorizeUrl(
    @Query("report") report: ExportReportKey = "overview",
    @Query("days") days?: string,
  ): { success: true; data: { authorizeUrl: string; state: string } } {
    const nonce = crypto.randomBytes(24).toString("hex");
    const state = encodeState(nonce, { report, days: days ? parseInt(days, 10) : 30 });

    return { success: true, data: { authorizeUrl: this.googleSheetsClient.buildAuthorizeUrl(state), state } };
  }

  @Post("export/google-sheets/exchange")
  async exchangeGoogleSheetsCode(
    @Body("code") code: string,
    @Body("state") state: string,
  ): Promise<{ success: true; data: { spreadsheetUrl: string } }> {
    if (!code || !state) {
      throw new BadRequestException("Missing code or state");
    }

    const { payload } = decodeState(state);
    const accessToken = await this.googleSheetsClient.exchangeCode(code);
    const rows = await this.analyticsService.getReportRows(payload);
    const title = `Exotic Push Engine — ${payload.report} (${payload.days}d) — ${new Date().toISOString().slice(0, 10)}`;
    const spreadsheetUrl = await this.googleSheetsClient.createSpreadsheet(accessToken, title, rows.headers, rows.rows);

    return { success: true, data: { spreadsheetUrl } };
  }
}
