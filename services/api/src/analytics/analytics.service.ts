import { Injectable } from "@nestjs/common";

import { AnalyticsRepository } from "./analytics.repository";

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async getCampaignStats(campaignId: string) {
    return this.analyticsRepository.getCampaignStats(campaignId);
  }

  async getSiteOverview(siteId: string, days = 30) {
    const [overview, delivery, growth] = await Promise.all([
      this.analyticsRepository.getSiteOverview(siteId),
      this.analyticsRepository.getSiteDeliveryStats(siteId, days),
      this.analyticsRepository.getSubscriberGrowth(siteId, days),
    ]);

    return {
      ...overview,
      last30Days: {
        ...delivery,
        subscriberGrowth: growth,
      },
    };
  }

  async getSubscriberGrowth(siteId: string, days = 30) {
    return this.analyticsRepository.getSubscriberGrowth(siteId, days);
  }

  async getOverview(days = 30) {
    return this.analyticsRepository.getOverview(days);
  }

  async getCountryPerformance(days = 30, siteId?: string) {
    return this.analyticsRepository.getCountryPerformance(days, siteId);
  }

  async getSitePerformance(days = 30, siteId?: string) {
    return this.analyticsRepository.getSitePerformance(days, siteId);
  }

  async getTimePerformance(days = 30, siteId?: string) {
    return this.analyticsRepository.getTimePerformance(days, siteId);
  }

  async getContentPerformance(days = 30, siteId?: string) {
    return this.analyticsRepository.getContentPerformance(days, siteId);
  }

  async exportReport(input: {
    report: "overview" | "countries" | "sites-performance" | "time-performance" | "content-performance";
    days: number;
  }): Promise<{ filename: string; csv: string }> {
    const rows = await this.resolveExportRows(input);
    const csv = this.toCsv(rows.headers, rows.rows);
    return {
      filename: `analytics-${input.report}-${input.days}d.csv`,
      csv,
    };
  }

  private async resolveExportRows(input: {
    report: "overview" | "countries" | "sites-performance" | "time-performance" | "content-performance";
    days: number;
  }): Promise<{ headers: string[]; rows: Array<Array<string | number>> }> {
    switch (input.report) {
      case "countries": {
        const rows = await this.getCountryPerformance(input.days);
        return {
          headers: ["country", "totalSubscribers", "totalDelivered", "totalSent", "totalFailed", "totalExpired", "totalClicked", "deliveryRate", "clickThroughRate"],
          rows: rows.map((row) => [row.country, row.totalSubscribers, row.totalDelivered, row.totalSent, row.totalFailed, row.totalExpired, row.totalClicked, row.deliveryRate, row.clickThroughRate]),
        };
      }
      case "sites-performance": {
        const rows = await this.getSitePerformance(input.days);
        return {
          headers: ["siteName", "siteId", "totalSubscribers", "totalDelivered", "totalSent", "totalFailed", "totalExpired", "totalClicked", "deliveryRate", "clickThroughRate"],
          rows: rows.map((row) => [row.siteName, row.siteId, row.totalSubscribers, row.totalDelivered, row.totalSent, row.totalFailed, row.totalExpired, row.totalClicked, row.deliveryRate, row.clickThroughRate]),
        };
      }
      case "time-performance": {
        const rows = await this.getTimePerformance(input.days);
        return {
          headers: ["hour", "totalDelivered", "totalSent", "totalFailed", "totalClicked", "deliveryRate", "clickThroughRate"],
          rows: rows.map((row) => [row.hour, row.totalDelivered, row.totalSent, row.totalFailed, row.totalClicked, row.deliveryRate, row.clickThroughRate]),
        };
      }
      case "content-performance": {
        const rows = await this.getContentPerformance(input.days);
        return {
          headers: ["contentType", "totalCampaigns", "totalDelivered", "totalSent", "totalFailed", "totalExpired", "totalClicked", "deliveryRate", "clickThroughRate"],
          rows: rows.map((row) => [row.contentType, row.totalCampaigns, row.totalDelivered, row.totalSent, row.totalFailed, row.totalExpired, row.totalClicked, row.deliveryRate, row.clickThroughRate]),
        };
      }
      case "overview":
      default: {
        const overview = await this.getOverview(input.days);
        return {
          headers: ["metric", "value"],
          rows: Object.entries(overview).map(([metric, value]) => [metric, value as string | number]),
        };
      }
    }
  }

  private toCsv(headers: string[], rows: Array<Array<string | number>>): string {
    const escape = (value: string | number): string => {
      const raw = String(value);
      if (/[",\n]/.test(raw)) {
        return `"${raw.replaceAll('"', '""')}"`;
      }
      return raw;
    };

    return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  }
}
