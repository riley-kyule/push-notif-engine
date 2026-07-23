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

  async recordInfrastructureIncident(input: {
    jobId: string;
    siteId: string;
    campaignId?: string | null;
    errorCode: string | null;
    errorMessage: string;
    failureCount: number;
  }): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO push_delivery_incidents (
        channel, provider, job_id, site_id, campaign_id, error_code, error_message, failure_count, metadata
      )
      VALUES ('browser', 'web-push', $1, $2, $3, $4, $5, $6, '{}'::jsonb)
      ON CONFLICT (channel, provider, job_id, error_code)
      DO UPDATE SET
        error_message = EXCLUDED.error_message,
        failure_count = GREATEST(push_delivery_incidents.failure_count, EXCLUDED.failure_count),
        status = 'open',
        last_seen_at = NOW(),
        updated_at = NOW()
      `,
      [input.jobId, input.siteId, input.campaignId ?? null, input.errorCode ?? "NETWORK_ERROR", input.errorMessage, input.failureCount],
    );
  }

  async markInfrastructureIncidentRecovered(jobId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE push_delivery_incidents
      SET status = 'recovered', recovered_at = NOW(), updated_at = NOW()
      WHERE channel = 'browser' AND job_id = $1 AND status = 'open'
      `,
      [jobId],
    );
  }

  async markInfrastructureIncidentExhausted(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE push_delivery_incidents SET status = 'exhausted', updated_at = NOW() WHERE channel = 'browser' AND job_id = $1 AND status = 'open'`,
      [jobId],
    );
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

  async findEligibleSubscriberById(siteId: string, subscriberId: string): Promise<BrowserPushSubscriberRow[]> {
    const { rows } = await this.pool.query<BrowserPushSubscriberRow>(
      `
      SELECT id, subscription_endpoint, p256dh_key, auth_key
      FROM subscribers
      WHERE site_id = $1
        AND id = $2
        AND status = 'active'
        AND p256dh_key IS NOT NULL
        AND auth_key IS NOT NULL
      LIMIT 1
      `,
      [siteId, subscriberId],
    );

    return rows;
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

  // One round trip for the whole batch instead of one INSERT per subscriber — matters
  // once batches reach tens of thousands of rows. Uses unnest() so the parameter count
  // stays fixed (2 arrays) regardless of batch size, rather than building a VALUES
  // list that could blow past Postgres's 65535-parameter limit on large sends.
  //
  // ON CONFLICT reuses the existing row instead of inserting a duplicate when this
  // job_id/subscriber pair already has one (see migration 030) -- without it, a
  // worker crash mid-job followed by BullMQ's stalled-job retry would insert a
  // second pending row per recipient on every retry, and that second row would
  // queue a real second push send to anyone the first attempt had already reached.
  async createPendingDeliveryEvents(input: {
    siteId: string;
    campaignId?: string | null;
    automationId?: string | null;
    jobId?: string | null;
    retrySourceEventId?: string | null;
    payload: BrowserPushNotificationPayload;
    subscribers: Array<{ subscriberId: string; endpoint: string; payload?: BrowserPushNotificationPayload }>;
  }): Promise<Map<string, string>> {
    if (input.subscribers.length === 0) {
      return new Map();
    }

    const { rows } = await this.pool.query<{ id: string; subscriber_id: string }>(
      `
      INSERT INTO push_delivery_events (
        site_id, campaign_id, automation_id, subscriber_id, endpoint, status, payload, job_id, retry_source_event_id, created_at, updated_at
      )
      SELECT $1::uuid, $2::uuid, $3::uuid, sub_id, ep, 'pending', item_payload, $4::text, $5::uuid, NOW(), NOW()
      FROM unnest($6::uuid[], $7::text[], $8::jsonb[]) AS t(sub_id, ep, item_payload)
      ON CONFLICT (job_id, subscriber_id) WHERE job_id IS NOT NULL AND subscriber_id IS NOT NULL
      DO UPDATE SET updated_at = push_delivery_events.updated_at
      RETURNING id, subscriber_id
      `,
      [
        input.siteId,
        input.campaignId ?? null,
        input.automationId ?? null,
        input.jobId ?? null,
        input.retrySourceEventId ?? null,
        input.subscribers.map((subscriber) => subscriber.subscriberId),
        input.subscribers.map((subscriber) => subscriber.endpoint),
        input.subscribers.map((subscriber) => JSON.stringify(subscriber.payload ?? input.payload)),
      ],
    );

    return new Map(rows.map((row) => [row.subscriber_id, row.id]));
  }

  // Lets a BullMQ-retried job (worker crash mid-job, or a transient failure that
  // triggered a job-level retry) skip subscribers it already successfully sent to,
  // instead of re-sending the same notification.
  async findAlreadySentSubscriberIds(jobId: string): Promise<Set<string>> {
    const { rows } = await this.pool.query<{ subscriber_id: string | null }>(
      `
      SELECT subscriber_id
      FROM push_delivery_events
      WHERE job_id = $1
        AND status IN ('sent', 'delivered')
        AND subscriber_id IS NOT NULL
      `,
      [jobId],
    );

    return new Set(rows.map((row) => row.subscriber_id).filter((id): id is string => Boolean(id)));
  }

  async markDeliveryEventSent(id: string, providerMessageId: string | null, retryCount: number): Promise<void> {
    await this.pool.query(
      `
      UPDATE push_delivery_events
      SET status = 'sent',
          provider_message_id = $2,
          error_code = NULL,
          error_message = NULL,
          sent_at = NOW(),
          updated_at = NOW(),
          retry_count = $3,
          last_attempted_at = NOW()
      WHERE id = $1
      `,
      [id, providerMessageId, retryCount],
    );
  }

  async markDeliveryEventFailed(
    id: string,
    input: {
      status: BrowserPushDeliveryStatus;
      errorCode: string | null;
      errorMessage: string | null;
      retryCount: number;
    },
  ): Promise<void> {
    await this.pool.query(
      `
      UPDATE push_delivery_events
      SET status = $2,
          error_code = $3,
          error_message = $4,
          updated_at = NOW(),
          retry_count = $5,
          last_attempted_at = NOW()
      WHERE id = $1
      `,
      [id, input.status, input.errorCode, input.errorMessage, input.retryCount],
    );
  }

  async markPendingDeliveryEventsFailed(jobId: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE push_delivery_events
      SET status = 'failed',
          error_code = 'INFRASTRUCTURE_RETRY_EXHAUSTED',
          error_message = $2,
          updated_at = NOW(),
          last_attempted_at = NOW()
      WHERE job_id = $1
        AND status = 'pending'
      `,
      [jobId, errorMessage],
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
