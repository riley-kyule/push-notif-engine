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

@Injectable()
export class BrowserPushRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

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
