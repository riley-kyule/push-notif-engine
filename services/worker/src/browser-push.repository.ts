import type { Pool } from "pg";

import type { BrowserPushDeliveryStatus, BrowserPushNotificationPayload } from "./browser-push.types";
import { buildSegmentFilterClause, type SegmentDefinition } from "./segment.util";

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

interface SegmentRow {
  match_mode: SegmentDefinition["matchMode"];
  rules: unknown;
}

export class BrowserPushRepository {
  constructor(private readonly pool: Pool) {}

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

  async findSegmentDefinition(segmentId: string): Promise<SegmentDefinition | null> {
    const { rows } = await this.pool.query<SegmentRow>(
      `
      SELECT match_mode, rules
      FROM segments
      WHERE id = $1
      LIMIT 1
      `,
      [segmentId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const rules = typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules;
    return { matchMode: row.match_mode, rules: rules as SegmentDefinition["rules"] };
  }

  async listEligibleSubscribers(siteId: string, segmentDefinition?: SegmentDefinition | null): Promise<BrowserPushSubscriberRow[]> {
    const params: Array<string | number | string[]> = [siteId];
    const clauses = ["site_id = $1", "status = 'active'", "p256dh_key IS NOT NULL", "auth_key IS NOT NULL"];

    if (segmentDefinition) {
      const built = buildSegmentFilterClause(segmentDefinition, params.length + 1);
      if (built.clause) {
        params.push(...built.params);
        clauses.push(built.clause);
      }
    }

    const { rows } = await this.pool.query<BrowserPushSubscriberRow>(
      `
      SELECT id, subscription_endpoint, p256dh_key, auth_key
      FROM subscribers
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at ASC
      `,
      params,
    );

    return rows;
  }

  async createPendingDeliveryEvent(input: {
    siteId: string;
    campaignId?: string | null;
    subscriberId: string | null;
    endpoint: string;
    payload: BrowserPushNotificationPayload;
  }): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `
      INSERT INTO push_delivery_events (
        site_id, campaign_id, subscriber_id, endpoint, status,
        provider_message_id, error_code, error_message, payload,
        sent_at, delivered_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'pending',
        NULL, NULL, NULL, $5,
        NULL, NULL, NOW(), NOW())
      RETURNING id
      `,
      [
        input.siteId,
        input.campaignId ?? null,
        input.subscriberId,
        input.endpoint,
        JSON.stringify(input.payload),
      ],
    );

    return rows[0]?.id ?? "";
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

  async markDeliveryEventFailed(input: {
    siteId: string;
    campaignId?: string | null;
    subscriberId: string | null;
    endpoint: string;
    status: BrowserPushDeliveryStatus;
    providerMessageId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    payload: BrowserPushNotificationPayload;
  }): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO push_delivery_events (
        site_id, campaign_id, subscriber_id, endpoint, status,
        provider_message_id, error_code, error_message, payload,
        sent_at, delivered_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        NULL, NULL, NOW(), NOW())
      `,
      [
        input.siteId,
        input.campaignId ?? null,
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

  async markSubscriberExpired(subscriberId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE subscribers
      SET status = 'expired', updated_at = NOW()
      WHERE id = $1
      `,
      [subscriberId],
    );
  }

  async markCampaignSent(campaignId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE campaigns
      SET status = 'sent', sent_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [campaignId],
    );
  }

  async markCampaignFailed(campaignId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE campaigns
      SET status = 'failed', updated_at = NOW()
      WHERE id = $1
      `,
      [campaignId],
    );
  }
}
