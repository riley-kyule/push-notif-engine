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

  async getCountryPerformance(days = 30) {
    return this.analyticsRepository.getCountryPerformance(days);
  }

  async getSitePerformance(days = 30) {
    return this.analyticsRepository.getSitePerformance(days);
  }

  async getTimePerformance(days = 30) {
    return this.analyticsRepository.getTimePerformance(days);
  }
}
