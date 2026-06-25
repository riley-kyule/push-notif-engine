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

interface FailedDeliveryReasonRow {
  failure_reason: string;
  failure_count: string;
}

interface SiteCountRow {
  total_sites: string;
}

interface DailyGrowthRow {
  date: string;
  new_subscribers: string;
}

interface CountryPerformanceRow {
  country: string;
  total_subscribers: string;
  total_delivered: string;
  total_sent: string;
  total_failed: string;
  total_expired: string;
  total_clicked: string;
}

interface SitePerformanceRow {
  site_id: string;
  site_name: string;
  total_subscribers: string;
  total_delivered: string;
  total_sent: string;
  total_failed: string;
  total_expired: string;
  total_clicked: string;
}

interface HourPerformanceRow {
  bucket: string;
  total_delivered: string;
  total_sent: string;
  total_failed: string;
  total_clicked: string;
}

interface ContentPerformanceRow {
  content_type: string;
  total_campaigns: string;
  total_delivered: string;
  total_sent: string;
  total_failed: string;
  total_expired: string;
  total_clicked: string;
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

  async getOverview(days: number, siteId?: string): Promise<{
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
    failedDeliveryReason: string | null;
    failedDeliveryReasonCount: number;
  }> {
    const [sitesResult, subscribersResult, campaignsResult, deliveryResult, failureReasonResult] = await Promise.all([
      siteId
        ? this.pool.query<SiteCountRow>(`SELECT COUNT(*)::text AS total_sites FROM sites WHERE id = $1`, [siteId])
        : this.pool.query<SiteCountRow>(`SELECT COUNT(*)::text AS total_sites FROM sites`),
      this.pool.query<SiteOverviewRow>(
        `
        SELECT
          COUNT(*)                                   AS total_subscribers,
          COUNT(*) FILTER (WHERE status = 'active') AS active_subscribers
        FROM subscribers
        ${siteId ? "WHERE site_id = $1" : ""}
        `,
        siteId ? [siteId] : [],
      ),
      this.pool.query<CampaignCountRow>(
        `
        SELECT
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'sending')) AS active_campaigns,
          COUNT(*)                                                    AS total_campaigns
        FROM campaigns
        ${siteId ? "WHERE site_id = $1" : ""}
        `,
        siteId ? [siteId] : [],
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
          ${siteId ? "AND site_id = $2" : ""}
        `,
        siteId ? [days, siteId] : [days],
      ),
      this.pool.query<FailedDeliveryReasonRow>(
        `
        WITH failure_reasons AS (
          SELECT
            CASE
              WHEN error_code IS NOT NULL AND error_message IS NOT NULL THEN error_code || ' ' || error_message
              WHEN error_code IS NOT NULL THEN error_code
              WHEN error_message IS NOT NULL THEN error_message
              ELSE 'Unknown failure'
            END AS failure_reason
          FROM push_delivery_events
          WHERE status = 'failed'
            AND created_at >= NOW() - ($1 || ' days')::interval
            ${siteId ? "AND site_id = $2" : ""}
        )
        SELECT failure_reason, COUNT(*)::text AS failure_count
        FROM failure_reasons
        GROUP BY failure_reason
        ORDER BY COUNT(*) DESC, failure_reason ASC
        LIMIT 1
        `,
        siteId ? [days, siteId] : [days],
      ),
    ]);

    const siteRow = sitesResult.rows[0];
    const subscriberRow = subscribersResult.rows[0];
    const campaignRow = campaignsResult.rows[0];
    const deliveryRow = deliveryResult.rows[0];
    const failureReasonRow = failureReasonResult.rows[0];

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
      failedDeliveryReason: failureReasonRow?.failure_reason ?? null,
      failedDeliveryReasonCount: parseInt(failureReasonRow?.failure_count ?? "0", 10),
    };
  }

  async getCountryPerformance(days: number, siteId?: string): Promise<
    Array<{
      country: string;
      totalSubscribers: number;
      totalDelivered: number;
      totalSent: number;
      totalFailed: number;
      totalExpired: number;
      totalClicked: number;
      deliveryRate: number;
      clickThroughRate: number;
    }>
  > {
    const { rows } = await this.pool.query<CountryPerformanceRow>(
      `
      SELECT
        COALESCE(NULLIF(s.country, ''), 'Unknown') AS country,
        COUNT(DISTINCT s.id) AS total_subscribers,
        COUNT(*) FILTER (WHERE pde.status = 'delivered') AS total_delivered,
        COUNT(*) FILTER (WHERE pde.status = 'sent') AS total_sent,
        COUNT(*) FILTER (WHERE pde.status = 'failed') AS total_failed,
        COUNT(*) FILTER (WHERE pde.status = 'expired') AS total_expired,
        COUNT(*) FILTER (WHERE pde.clicked_at IS NOT NULL) AS total_clicked
      FROM subscribers s
      LEFT JOIN push_delivery_events pde
        ON pde.subscriber_id = s.id
       AND pde.created_at >= NOW() - ($1 || ' days')::interval
      ${siteId ? "WHERE s.site_id = $2" : ""}
      GROUP BY COALESCE(NULLIF(s.country, ''), 'Unknown')
      ORDER BY total_delivered DESC, total_subscribers DESC
      `,
      siteId ? [days, siteId] : [days],
    );

    return rows.map((row) => {
      const totalDelivered = parseInt(row.total_delivered ?? "0", 10);
      const totalSent = parseInt(row.total_sent ?? "0", 10);
      const totalClicked = parseInt(row.total_clicked ?? "0", 10);
      const totalAttempts = totalSent + totalDelivered + parseInt(row.total_failed ?? "0", 10) + parseInt(row.total_expired ?? "0", 10);
      const successfullyHandedOff = totalSent + totalDelivered;

      return {
        country: row.country,
        totalSubscribers: parseInt(row.total_subscribers ?? "0", 10),
        totalDelivered,
        totalSent,
        totalFailed: parseInt(row.total_failed ?? "0", 10),
        totalExpired: parseInt(row.total_expired ?? "0", 10),
        totalClicked,
        deliveryRate: totalAttempts > 0 ? Math.round((totalDelivered / totalAttempts) * 10000) / 100 : 0,
        clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
      };
    });
  }

  async getSitePerformance(days: number, siteId?: string): Promise<
    Array<{
      siteId: string;
      siteName: string;
      totalSubscribers: number;
      totalDelivered: number;
      totalSent: number;
      totalFailed: number;
      totalExpired: number;
      totalClicked: number;
      deliveryRate: number;
      clickThroughRate: number;
    }>
  > {
    const { rows } = await this.pool.query<SitePerformanceRow>(
      `
      WITH subscriber_totals AS (
        SELECT site_id, COUNT(*)::int AS total_subscribers
        FROM subscribers
        ${siteId ? "WHERE site_id = $2" : ""}
        GROUP BY site_id
      ),
      delivery_totals AS (
        SELECT
          site_id,
          COUNT(*) FILTER (WHERE status = 'delivered') AS total_delivered,
          COUNT(*) FILTER (WHERE status = 'sent') AS total_sent,
          COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
          COUNT(*) FILTER (WHERE status = 'expired') AS total_expired,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS total_clicked
        FROM push_delivery_events
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        ${siteId ? "AND site_id = $2" : ""}
        GROUP BY site_id
      )
      SELECT
        s.id AS site_id,
        s.name AS site_name,
        COALESCE(st.total_subscribers, 0)::text AS total_subscribers,
        COALESCE(dt.total_delivered, 0)::text AS total_delivered,
        COALESCE(dt.total_sent, 0)::text AS total_sent,
        COALESCE(dt.total_failed, 0)::text AS total_failed,
        COALESCE(dt.total_expired, 0)::text AS total_expired,
        COALESCE(dt.total_clicked, 0)::text AS total_clicked
      FROM sites s
      LEFT JOIN subscriber_totals st ON st.site_id = s.id
      LEFT JOIN delivery_totals dt ON dt.site_id = s.id
      ${siteId ? "WHERE s.id = $2" : ""}
      ORDER BY total_delivered DESC, total_subscribers DESC
      `,
      siteId ? [days, siteId] : [days],
    );

    return rows.map((row) => {
      const totalDelivered = parseInt(row.total_delivered ?? "0", 10);
      const totalSent = parseInt(row.total_sent ?? "0", 10);
      const totalFailed = parseInt(row.total_failed ?? "0", 10);
      const totalExpired = parseInt(row.total_expired ?? "0", 10);
      const totalClicked = parseInt(row.total_clicked ?? "0", 10);
      const totalAttempts = totalSent + totalDelivered + totalFailed + totalExpired;
      const successfullyHandedOff = totalSent + totalDelivered;

      return {
        siteId: row.site_id,
        siteName: row.site_name,
        totalSubscribers: parseInt(row.total_subscribers ?? "0", 10),
        totalDelivered,
        totalSent,
        totalFailed,
        totalExpired,
        totalClicked,
        deliveryRate: totalAttempts > 0 ? Math.round((totalDelivered / totalAttempts) * 10000) / 100 : 0,
        clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
      };
    });
  }

  async getTimePerformance(days: number, siteId?: string): Promise<
    Array<{
      bucket: string;
      totalDelivered: number;
      totalSent: number;
      totalFailed: number;
      totalClicked: number;
      deliveryRate: number;
      clickThroughRate: number;
    }>
  > {
    // Hourly buckets only make sense within a single day -- across a wider
    // range, bucketing by calendar day is what lets the chart actually show
    // a trend over the selected range instead of collapsing every day onto
    // the same 24 hour-of-day buckets.
    const granularity = days <= 1 ? "hour" : "day";
    const params: Array<string | number> = siteId ? [days, siteId, granularity] : [days, granularity];
    const siteParamIndex = siteId ? 2 : null;
    const granularityParamIndex = siteId ? 3 : 2;

    const { rows } = await this.pool.query<HourPerformanceRow>(
      `
      SELECT
        date_trunc($${granularityParamIndex}, created_at AT TIME ZONE 'UTC') AS bucket,
        COUNT(*) FILTER (WHERE status = 'delivered') AS total_delivered,
        COUNT(*) FILTER (WHERE status = 'sent') AS total_sent,
        COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS total_clicked
      FROM push_delivery_events
      WHERE created_at >= NOW() - ($1 || ' days')::interval
      ${siteParamIndex ? `AND site_id = $${siteParamIndex}` : ""}
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      params,
    );

    return rows.map((row) => {
      const totalDelivered = parseInt(row.total_delivered ?? "0", 10);
      const totalSent = parseInt(row.total_sent ?? "0", 10);
      const totalFailed = parseInt(row.total_failed ?? "0", 10);
      const totalClicked = parseInt(row.total_clicked ?? "0", 10);
      const totalAttempts = totalSent + totalDelivered + totalFailed;
      const successfullyHandedOff = totalSent + totalDelivered;

      return {
        bucket: new Date(row.bucket).toISOString(),
        totalDelivered,
        totalSent,
        totalFailed,
        totalClicked,
        deliveryRate: totalAttempts > 0 ? Math.round((totalDelivered / totalAttempts) * 10000) / 100 : 0,
        clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
      };
    });
  }

  async getContentPerformance(days: number, siteId?: string): Promise<
    Array<{
      contentType: string;
      totalCampaigns: number;
      totalDelivered: number;
      totalSent: number;
      totalFailed: number;
      totalExpired: number;
      totalClicked: number;
      deliveryRate: number;
      clickThroughRate: number;
    }>
  > {
    const { rows } = await this.pool.query<ContentPerformanceRow>(
      `
      SELECT
        COALESCE(NULLIF(c.content_type, ''), 'announcement') AS content_type,
        COUNT(DISTINCT c.id) AS total_campaigns,
        COUNT(*) FILTER (WHERE pde.status = 'delivered') AS total_delivered,
        COUNT(*) FILTER (WHERE pde.status = 'sent') AS total_sent,
        COUNT(*) FILTER (WHERE pde.status = 'failed') AS total_failed,
        COUNT(*) FILTER (WHERE pde.status = 'expired') AS total_expired,
        COUNT(*) FILTER (WHERE pde.clicked_at IS NOT NULL) AS total_clicked
      FROM campaigns c
      LEFT JOIN push_delivery_events pde
        ON pde.campaign_id = c.id
       AND pde.created_at >= NOW() - ($1 || ' days')::interval
      ${siteId ? "WHERE c.site_id = $2" : ""}
      GROUP BY COALESCE(NULLIF(c.content_type, ''), 'announcement')
      ORDER BY total_delivered DESC, total_campaigns DESC
      `,
      siteId ? [days, siteId] : [days],
    );

    return rows.map((row) => {
      const totalDelivered = parseInt(row.total_delivered ?? "0", 10);
      const totalSent = parseInt(row.total_sent ?? "0", 10);
      const totalFailed = parseInt(row.total_failed ?? "0", 10);
      const totalExpired = parseInt(row.total_expired ?? "0", 10);
      const totalClicked = parseInt(row.total_clicked ?? "0", 10);
      const totalAttempts = totalSent + totalDelivered + totalFailed + totalExpired;
      const successfullyHandedOff = totalSent + totalDelivered;

      return {
        contentType: row.content_type,
        totalCampaigns: parseInt(row.total_campaigns ?? "0", 10),
        totalDelivered,
        totalSent,
        totalFailed,
        totalExpired,
        totalClicked,
        deliveryRate: totalAttempts > 0 ? Math.round((totalDelivered / totalAttempts) * 10000) / 100 : 0,
        clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
      };
    });
  }
}
