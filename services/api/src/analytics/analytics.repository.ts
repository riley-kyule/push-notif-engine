import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";

interface CampaignStatsRow {
  pending: string;
  sent: string;
  delivered: string;
  failed: string;
  expired: string;
  clicked: string;
  total: string;
}

interface SiteOverviewRow {
  total_subscribers: string;
  active_subscribers: string;
}

interface CampaignCountRow {
  active_campaigns: string;
  total_campaigns: string;
}

interface SiteCountRow {
  total_sites: string;
}

interface DailyGrowthRow {
  date: string;
  new_subscribers: string;
}

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async getCampaignStats(campaignId: string): Promise<{
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
    expired: number;
    clicked: number;
    total: number;
    deliveryRate: number;
    clickThroughRate: number;
  }> {
    const { rows } = await this.pool.query<CampaignStatsRow>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        COUNT(*)                                    AS total
      FROM push_delivery_events
      WHERE campaign_id = $1
      `,
      [campaignId],
    );

    const row = rows[0];
    const pending = parseInt(row?.pending ?? "0", 10);
    const sent = parseInt(row?.sent ?? "0", 10);
    const delivered = parseInt(row?.delivered ?? "0", 10);
    const failed = parseInt(row?.failed ?? "0", 10);
    const expired = parseInt(row?.expired ?? "0", 10);
    const clicked = parseInt(row?.clicked ?? "0", 10);
    const total = parseInt(row?.total ?? "0", 10);
    const successfullyHandedOff = sent + delivered;

    return {
      pending,
      sent,
      delivered,
      failed,
      expired,
      clicked,
      total,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0,
      clickThroughRate: successfullyHandedOff > 0 ? Math.round((clicked / successfullyHandedOff) * 10000) / 100 : 0,
    };
  }

  async getSiteOverview(siteId: string): Promise<{
    totalSubscribers: number;
    activeSubscribers: number;
  }> {
    const { rows } = await this.pool.query<SiteOverviewRow>(
      `
      SELECT
        COUNT(*)                                        AS total_subscribers,
        COUNT(*) FILTER (WHERE status = 'active')      AS active_subscribers
      FROM subscribers
      WHERE site_id = $1
      `,
      [siteId],
    );

    const row = rows[0];
    return {
      totalSubscribers: parseInt(row?.total_subscribers ?? "0", 10),
      activeSubscribers: parseInt(row?.active_subscribers ?? "0", 10),
    };
  }

  async getSubscriberGrowth(siteId: string, days: number): Promise<Array<{ date: string; newSubscribers: number }>> {
    const { rows } = await this.pool.query<DailyGrowthRow>(
      `
      SELECT
        DATE(created_at AT TIME ZONE 'UTC') AS date,
        COUNT(*)                             AS new_subscribers
      FROM subscribers
      WHERE site_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
      `,
      [siteId, days],
    );

    return rows.map((row) => ({
      date: row.date,
      newSubscribers: parseInt(row.new_subscribers, 10),
    }));
  }

  async getSiteDeliveryStats(siteId: string, days: number): Promise<{
    totalPending: number;
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalExpired: number;
    totalClicked: number;
    clickThroughRate: number;
  }> {
    const { rows } = await this.pool.query<CampaignStatsRow>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        COUNT(*)                                    AS total
      FROM push_delivery_events
      WHERE site_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
      `,
      [siteId, days],
    );

    const row = rows[0];
    const totalSent = parseInt(row?.sent ?? "0", 10);
    const totalDelivered = parseInt(row?.delivered ?? "0", 10);
    const totalClicked = parseInt(row?.clicked ?? "0", 10);
    const successfullyHandedOff = totalSent + totalDelivered;

    return {
      totalPending: parseInt(row?.pending ?? "0", 10),
      totalSent,
      totalDelivered,
      totalFailed: parseInt(row?.failed ?? "0", 10),
      totalExpired: parseInt(row?.expired ?? "0", 10),
      totalClicked,
      clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
    };
  }

  async getOverview(days: number): Promise<{
    totalSites: number;
    totalSubscribers: number;
    activeSubscribers: number;
    activeCampaigns: number;
    totalCampaigns: number;
    totalPending: number;
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalClicked: number;
    deliveryRate: number;
    clickThroughRate: number;
  }> {
    const [sitesResult, subscribersResult, campaignsResult, deliveryResult] = await Promise.all([
      this.pool.query<SiteCountRow>(`SELECT COUNT(*)::text AS total_sites FROM sites`),
      this.pool.query<SiteOverviewRow>(
        `
        SELECT
          COUNT(*)                                   AS total_subscribers,
          COUNT(*) FILTER (WHERE status = 'active') AS active_subscribers
        FROM subscribers
        `,
      ),
      this.pool.query<CampaignCountRow>(
        `
        SELECT
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'sending')) AS active_campaigns,
          COUNT(*)                                                    AS total_campaigns
        FROM campaigns
        `,
      ),
      this.pool.query<CampaignStatsRow>(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
          COUNT(*) FILTER (WHERE status = 'sent')       AS sent,
          COUNT(*) FILTER (WHERE status = 'delivered')  AS delivered,
          COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
          COUNT(*) FILTER (WHERE status = 'expired')    AS expired,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
          COUNT(*)                                        AS total
        FROM push_delivery_events
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        `,
        [days],
      ),
    ]);

    const siteRow = sitesResult.rows[0];
    const subscriberRow = subscribersResult.rows[0];
    const campaignRow = campaignsResult.rows[0];
    const deliveryRow = deliveryResult.rows[0];

    const totalSent = parseInt(deliveryRow?.sent ?? "0", 10);
    const totalDelivered = parseInt(deliveryRow?.delivered ?? "0", 10);
    const totalFailed = parseInt(deliveryRow?.failed ?? "0", 10);
    const totalClicked = parseInt(deliveryRow?.clicked ?? "0", 10);
    const total = parseInt(deliveryRow?.total ?? "0", 10);
    const successfullyHandedOff = totalSent + totalDelivered;

    return {
      totalSites: parseInt(siteRow?.total_sites ?? "0", 10),
      totalSubscribers: parseInt(subscriberRow?.total_subscribers ?? "0", 10),
      activeSubscribers: parseInt(subscriberRow?.active_subscribers ?? "0", 10),
      activeCampaigns: parseInt(campaignRow?.active_campaigns ?? "0", 10),
      totalCampaigns: parseInt(campaignRow?.total_campaigns ?? "0", 10),
      totalPending: parseInt(deliveryRow?.pending ?? "0", 10),
      totalSent,
      totalDelivered,
      totalFailed,
      totalClicked,
      deliveryRate: total > 0 ? Math.round((totalDelivered / total) * 10000) / 100 : 0,
      clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
    };
  }
}
