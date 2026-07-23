import crypto from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Pool } from "pg";

import { AnalyticsService } from "../analytics/analytics.service";
import { assertSafeFetchTarget } from "../common/ssrf-guard";
import { DATABASE_POOL } from "../database/database.constants";

interface DueCallback {
  id: string;
  siteId: string;
  campaignId: string;
  callbackUrl: string;
  campaignStatus: string;
  attemptCount: number;
}

@Injectable()
export class NotificationCallbackService {
  private readonly logger = new Logger(NotificationCallbackService.name);

  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async register(siteId: string, campaignId: string, callbackUrl: string): Promise<void> {
    await assertSafeFetchTarget(callbackUrl);
    await this.pool.query(
      `INSERT INTO notification_callbacks (site_id, campaign_id, callback_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (campaign_id) DO UPDATE SET callback_url = EXCLUDED.callback_url, status = 'pending',
         attempt_count = 0, next_attempt_at = NOW(), last_error = NULL, updated_at = NOW()`,
      [siteId, campaignId, callbackUrl],
    );
  }

  async getStatus(campaignId: string): Promise<{
    status: "pending" | "retrying" | "delivered" | "exhausted";
    attemptCount: number;
    lastAttemptedAt: string | null;
    deliveredAt: string | null;
    lastHttpStatus: number | null;
    lastError: string | null;
  } | null> {
    const { rows } = await this.pool.query<{
      status: "pending" | "retrying" | "delivered" | "exhausted";
      attempt_count: number; last_attempted_at: string | null; delivered_at: string | null;
      last_http_status: number | null; last_error: string | null;
    }>(
      `SELECT status, attempt_count, last_attempted_at, delivered_at, last_http_status, last_error
       FROM notification_callbacks WHERE campaign_id = $1 LIMIT 1`,
      [campaignId],
    );
    const row = rows[0];
    return row ? {
      status: row.status, attemptCount: row.attempt_count, lastAttemptedAt: row.last_attempted_at,
      deliveredAt: row.delivered_at, lastHttpStatus: row.last_http_status, lastError: row.last_error,
    } : null;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async deliverDueCallbacks(): Promise<void> {
    const callbacks = await this.claimDueCallbacks(100);
    const concurrency = 10;
    for (let index = 0; index < callbacks.length; index += concurrency) {
      await Promise.allSettled(callbacks.slice(index, index + concurrency).map((callback) => this.deliver(callback)));
    }
  }

  private async claimDueCallbacks(limit: number): Promise<DueCallback[]> {
    const { rows } = await this.pool.query<{
      id: string; site_id: string; campaign_id: string; callback_url: string;
      campaign_status: string; attempt_count: number;
    }>(
      `
      WITH due AS (
        SELECT nc.id
        FROM notification_callbacks nc
        JOIN campaigns c ON c.id = nc.campaign_id
        WHERE nc.status IN ('pending', 'retrying')
          AND nc.next_attempt_at <= NOW()
          AND (c.status = 'failed' OR (c.status = 'sent' AND c.sent_at <= NOW() - INTERVAL '2 minutes'))
        ORDER BY nc.next_attempt_at ASC
        LIMIT $1
        FOR UPDATE OF nc SKIP LOCKED
      )
      UPDATE notification_callbacks nc
      SET next_attempt_at = NOW() + INTERVAL '2 minutes', updated_at = NOW()
      FROM due, campaigns c
      WHERE nc.id = due.id AND c.id = nc.campaign_id
      RETURNING nc.id, nc.site_id, nc.campaign_id, nc.callback_url,
                c.status AS campaign_status, nc.attempt_count
      `,
      [limit],
    );
    return rows.map((row) => ({
      id: row.id, siteId: row.site_id, campaignId: row.campaign_id,
      callbackUrl: row.callback_url, campaignStatus: row.campaign_status,
      attemptCount: row.attempt_count,
    }));
  }

  private async deliver(callback: DueCallback): Promise<void> {
    const stats = await this.analyticsService.getCampaignStats(callback.campaignId);
    const body = JSON.stringify({
      event: "notification.completed",
      notificationId: callback.campaignId,
      siteId: callback.siteId,
      status: callback.campaignStatus,
      ...stats,
      occurredAt: new Date().toISOString(),
    });
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "ExoticPushEngine/1.0",
      "x-epe-callback-id": callback.id,
    };
    const signingSecret = process.env.CRM_CALLBACK_SIGNING_SECRET;
    if (signingSecret) {
      headers["x-epe-signature"] = `sha256=${crypto.createHmac("sha256", signingSecret).update(body).digest("hex")}`;
    }

    try {
      await assertSafeFetchTarget(callback.callbackUrl);
      const response = await fetch(callback.callbackUrl, {
        method: "POST", headers, body, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw Object.assign(new Error(`Callback returned HTTP ${response.status}`), { status: response.status });
      await this.pool.query(
        `UPDATE notification_callbacks SET status = 'delivered', attempt_count = attempt_count + 1,
         last_attempted_at = NOW(), delivered_at = NOW(), last_http_status = $2, last_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [callback.id, response.status],
      );
    } catch (error) {
      const attempt = callback.attemptCount + 1;
      const exhausted = attempt >= 8;
      const message = error instanceof Error ? error.message : "Unknown callback failure";
      const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : null;
      const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
      await this.pool.query(
        `UPDATE notification_callbacks SET status = $2, attempt_count = $3, last_attempted_at = NOW(),
         next_attempt_at = NOW() + ($4::text || ' seconds')::interval,
         last_http_status = $5, last_error = $6, updated_at = NOW() WHERE id = $1`,
        [callback.id, exhausted ? "exhausted" : "retrying", attempt, delaySeconds, status, message],
      );
      this.logger.warn(`CRM callback ${callback.id} failed on attempt ${attempt}: ${message}`);
    }
  }
}
