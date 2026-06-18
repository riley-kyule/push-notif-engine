import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";

interface CampaignStatsRow {
  pending: string;
  sent: string;
  delivered: string;
  failed: string;
  expired: string;
  total: string;
}

interface SiteOverviewRow {
  total_subscribers: string;
  active_subscribers: string;
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
    total: number;
    deliveryRate: number;
  }> {
    const { rows } = await this.pool.query<CampaignStatsRow>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired,
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
    const total = parseInt(row?.total ?? "0", 10);

    return {
      pending,
      sent,
      delivered,
      failed,
      expired,
      total,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0,
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
  }> {
    const { rows } = await this.pool.query<CampaignStatsRow>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired,
        COUNT(*)                                    AS total
      FROM push_delivery_events
      WHERE site_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
      `,
      [siteId, days],
    );

    const row = rows[0];
    return {
      totalPending: parseInt(row?.pending ?? "0", 10),
      totalSent: parseInt(row?.sent ?? "0", 10),
      totalDelivered: parseInt(row?.delivered ?? "0", 10),
      totalFailed: parseInt(row?.failed ?? "0", 10),
      totalExpired: parseInt(row?.expired ?? "0", 10),
    };
  }
}
