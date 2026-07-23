import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { BrowserPushDeliveryEventInput, BrowserPushNotificationPayload } from "./browser-push.types";

interface BrowserPushSiteRow {
  id: string;
  vapid_subject: string | null;
  vapid_public_key: string | null;
  vapid_private_key: string | null;
}

interface BrowserPushSubscriberRow {
  id: string;
  subscription_endpoint: string;
  p256dh_key: string | null;
  auth_key: string | null;
}

export interface RetryableBrowserPushDelivery {
  id: string;
  siteId: string;
  campaignId: string | null;
  automationId: string | null;
  subscriberId: string;
  notification: BrowserPushNotificationPayload;
}

@Injectable()
export class BrowserPushRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // Permanently removes failed-delivery history -- a deliberate reset, not a
  // retention policy. Deliveries that are still pending/sent/delivered are
  // untouched.
  async clearFailedDeliveries(): Promise<number> {
    const result = await this.pool.query(`DELETE FROM push_delivery_events WHERE status = 'failed'`);
    return result.rowCount ?? 0;
  }

  // Full reset: every delivery record regardless of status -- sent,
  // delivered, pending, expired, failed. Every metric derived from this
  // table (CTR, delivery rate, sent/delivered counts) goes back to zero.
  // Deliberately separate from clearFailedDeliveries rather than a shared
  // "status?" parameter, so this far more destructive action can never be
  // triggered by a default/omitted argument.
  async clearAllDeliveryHistory(): Promise<number> {
    const result = await this.pool.query(`DELETE FROM push_delivery_events`);
    return result.rowCount ?? 0;
  }

  async claimRetryableTransientDeliveries(input: { siteId?: string; limit: number }): Promise<RetryableBrowserPushDelivery[]> {
    const params: Array<string | number> = [];
    const siteClause = input.siteId ? `AND pde.site_id = $${params.push(input.siteId)}` : "";
    params.push(input.limit);

    const { rows } = await this.pool.query<{
      id: string;
      site_id: string;
      campaign_id: string | null;
      automation_id: string | null;
      subscriber_id: string;
      payload: BrowserPushNotificationPayload | string;
    }>(
      `
      WITH candidates AS (
        SELECT pde.id
        FROM push_delivery_events pde
        JOIN subscribers sub ON sub.id = pde.subscriber_id AND sub.status = 'active'
        WHERE pde.status = 'failed'
          AND pde.retried_at IS NULL
          AND pde.subscriber_id IS NOT NULL
          AND (
            pde.error_code IN ('EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH', '429', '500', '502', '503', '504', 'INFRASTRUCTURE_RETRY_EXHAUSTED')
            OR pde.error_message ~* '(EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|timed out|response code 5[0-9][0-9])'
          )
          ${siteClause}
        ORDER BY pde.created_at ASC
        LIMIT $${params.length}
        FOR UPDATE OF pde SKIP LOCKED
      )
      UPDATE push_delivery_events pde
      SET retried_at = NOW(), updated_at = NOW()
      FROM candidates
      WHERE pde.id = candidates.id
      RETURNING pde.id, pde.site_id, pde.campaign_id, pde.automation_id, pde.subscriber_id, pde.payload
      `,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      campaignId: row.campaign_id,
      automationId: row.automation_id,
      subscriberId: row.subscriber_id,
      notification: typeof row.payload === "string" ? JSON.parse(row.payload) as BrowserPushNotificationPayload : row.payload,
    }));
  }

  async markDeliveriesRetried(items: Array<{ deliveryId: string; jobId: string }>): Promise<void> {
    if (items.length === 0) return;
    await this.pool.query(
      `
      UPDATE push_delivery_events pde
      SET retry_job_id = retry.job_id, updated_at = NOW()
      FROM unnest($1::uuid[], $2::text[]) AS retry(delivery_id, job_id)
      WHERE pde.id = retry.delivery_id
      `,
      [items.map((item) => item.deliveryId), items.map((item) => item.jobId)],
    );
  }

  async releaseRetryClaims(deliveryIds: string[]): Promise<void> {
    if (deliveryIds.length === 0) return;
    await this.pool.query(
      `UPDATE push_delivery_events SET retried_at = NULL, updated_at = NOW() WHERE id = ANY($1::uuid[]) AND retry_job_id IS NULL`,
      [deliveryIds],
    );
  }

  async findSiteCredentials(siteId: string): Promise<BrowserPushSiteRow | null> {
    const { rows } = await this.pool.query<BrowserPushSiteRow>(
      `
      SELECT id, vapid_subject, vapid_public_key, vapid_private_key
      FROM sites
      WHERE id = $1
      LIMIT 1
      `,
      [siteId],
    );

    return rows[0] ?? null;
  }

  async listEligibleSubscribers(siteId: string): Promise<BrowserPushSubscriberRow[]> {
    const { rows } = await this.pool.query<BrowserPushSubscriberRow>(
      `
      SELECT id, subscription_endpoint, p256dh_key, auth_key
      FROM subscribers
      WHERE site_id = $1
        AND status = 'active'
        AND subscription_endpoint IS NOT NULL
      ORDER BY created_at ASC
      `,
      [siteId],
    );

    return rows.filter((row) => Boolean(row.p256dh_key && row.auth_key));
  }

  async createPendingDeliveryEvent(input: {
    siteId: string;
    subscriberId: string | null;
    endpoint: string;
    payload: BrowserPushNotificationPayload;
  }): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `
      INSERT INTO push_delivery_events (
        site_id, subscriber_id, endpoint, status, provider_message_id, error_code, error_message, payload, sent_at, delivered_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, 'pending', NULL, NULL, NULL, $4, NULL, NULL, NOW(), NOW())
      RETURNING id
      `,
      [
        input.siteId,
        input.subscriberId,
        input.endpoint,
        JSON.stringify(input.payload),
      ],
    );

    return rows[0]?.id ?? "";
  }

  async markDeliveryEventDelivered(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      UPDATE push_delivery_events
      SET status = 'delivered',
          delivered_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('pending', 'sent')
      `,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async markDeliveryEventClicked(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      UPDATE push_delivery_events
      SET clicked_at = NOW(),
          status = CASE WHEN status IN ('pending', 'sent') THEN 'delivered' ELSE status END,
          delivered_at = COALESCE(delivered_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
        AND clicked_at IS NULL
      `,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async findDeliveryEventContext(
    id: string,
  ): Promise<{ siteId: string; subscriberId: string | null; campaignId: string | null } | null> {
    const { rows } = await this.pool.query<{ site_id: string; subscriber_id: string | null; campaign_id: string | null }>(
      `
      SELECT site_id, subscriber_id, campaign_id
      FROM push_delivery_events
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? { siteId: row.site_id, subscriberId: row.subscriber_id, campaignId: row.campaign_id } : null;
  }

  async markDeliveryEventSent(id: string, providerMessageId: string | null): Promise<void> {
    await this.pool.query(
      `
      UPDATE push_delivery_events
      SET status = 'sent',
          provider_message_id = $2,
          error_code = NULL,
          error_message = NULL,
          sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [id, providerMessageId],
    );
  }

  async markDeliveryEventFailed(input: BrowserPushDeliveryEventInput): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO push_delivery_events (
        site_id, subscriber_id, endpoint, status, provider_message_id, error_code, error_message, payload, sent_at, delivered_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL, NOW(), NOW())
      `,
      [
        input.siteId,
        input.subscriberId,
        input.endpoint,
        input.status,
        input.providerMessageId,
        input.errorCode,
        input.errorMessage,
        JSON.stringify(input.payload),
      ],
    );
  }
}
