import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { AutomationTriggerEvent } from "../automations/automations.types";
import type { CreateRssFeedInput, RssFeedRecord, SubscriberTagRecord, UpdateRssFeedInput, WorkflowEventRecord } from "./workflow.types";
import type { WorkflowRepository } from "./workflow.repository";

@Injectable()
export class PostgresWorkflowRepository implements WorkflowRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async recordEvent(input: {
    siteId: string;
    subscriberId?: string | null;
    campaignId?: string | null;
    triggerEvent: AutomationTriggerEvent;
    payload: Record<string, unknown>;
  }): Promise<WorkflowEventRecord> {
    const { rows } = await this.pool.query<{
      id: string;
      site_id: string;
      subscriber_id: string | null;
      campaign_id: string | null;
      trigger_event: string;
      payload: unknown;
      status: string;
      error_message: string | null;
      executed_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO automation_events (
        site_id, subscriber_id, campaign_id, trigger_event, payload, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', NOW(), NOW())
      RETURNING *
      `,
      [input.siteId, input.subscriberId ?? null, input.campaignId ?? null, input.triggerEvent, JSON.stringify(input.payload)],
    );

    const row = rows[0];
    if (!row) throw new Error("Failed to record automation event");

    return this.mapEventRow(row);
  }

  async markEventCompleted(eventId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE automation_events
      SET status = 'completed', executed_at = NOW(), error_message = NULL, updated_at = NOW()
      WHERE id = $1
      `,
      [eventId],
    );
  }

  async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE automation_events
      SET status = 'failed', error_message = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [eventId, errorMessage],
    );
  }

  async listEvents(filters: { siteId?: string; status?: "pending" | "completed" | "failed"; limit: number; offset: number }): Promise<{ items: WorkflowEventRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.siteId) {
      params.push(filters.siteId);
      where.push(`site_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const listParams = [...params, filters.limit, filters.offset];
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<{
        id: string;
        site_id: string;
        subscriber_id: string | null;
        campaign_id: string | null;
        trigger_event: string;
        payload: unknown;
        status: string;
        error_message: string | null;
        executed_at: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT * FROM automation_events ${whereClause} ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      ),
      this.pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM automation_events ${whereClause}`, params),
    ]);

    return {
      items: itemsResult.rows.map((row) => this.mapEventRow(row)),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async addSubscriberTag(subscriberId: string, tag: string): Promise<SubscriberTagRecord> {
    const { rows } = await this.pool.query<{
      id: string;
      subscriber_id: string;
      tag: string;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO subscriber_tags (subscriber_id, tag)
      VALUES ($1, $2)
      ON CONFLICT (subscriber_id, tag)
      DO UPDATE SET updated_at = NOW()
      RETURNING *
      `,
      [subscriberId, tag],
    );

    const row = rows[0];
    if (!row) throw new Error("Failed to add subscriber tag");
    return this.mapTagRow(row);
  }

  async removeSubscriberTag(subscriberId: string, tag: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM subscriber_tags WHERE subscriber_id = $1 AND tag = $2`, [subscriberId, tag]);
    return (result.rowCount ?? 0) > 0;
  }

  async listSubscriberTags(subscriberId: string): Promise<SubscriberTagRecord[]> {
    const { rows } = await this.pool.query<{
      id: string;
      subscriber_id: string;
      tag: string;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, subscriber_id, tag, created_at, updated_at
      FROM subscriber_tags
      WHERE subscriber_id = $1
      ORDER BY created_at ASC
      `,
      [subscriberId],
    );

    return rows.map((row) => this.mapTagRow(row));
  }

  async createRssFeed(input: CreateRssFeedInput): Promise<RssFeedRecord> {
    const { rows } = await this.pool.query<{
      id: string;
      site_id: string;
      name: string;
      feed_url: string;
      status: "active" | "paused";
      last_item_guid: string | null;
      last_item_title: string | null;
      last_item_url: string | null;
      last_item_published_at: string | null;
      last_polled_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO rss_feeds (site_id, name, feed_url, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [input.siteId, input.name, input.feedUrl, input.status],
    );
    const row = rows[0];
    if (!row) throw new Error("Failed to create RSS feed");
    return this.mapFeedRow(row);
  }

  async updateRssFeed(id: string, input: UpdateRssFeedInput): Promise<RssFeedRecord | null> {
    const { rows } = await this.pool.query<{
      id: string;
      site_id: string;
      name: string;
      feed_url: string;
      status: "active" | "paused";
      last_item_guid: string | null;
      last_item_title: string | null;
      last_item_url: string | null;
      last_item_published_at: string | null;
      last_polled_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      UPDATE rss_feeds
      SET name = COALESCE($2, name),
          feed_url = COALESCE($3, feed_url),
          status = COALESCE($4, status),
          last_item_guid = COALESCE($5, last_item_guid),
          last_item_title = COALESCE($6, last_item_title),
          last_item_url = COALESCE($7, last_item_url),
          last_item_published_at = COALESCE($8, last_item_published_at),
          last_polled_at = COALESCE($9, last_polled_at),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        input.name ?? null,
        input.feedUrl ?? null,
        input.status ?? null,
        input.lastItemGuid ?? null,
        input.lastItemTitle ?? null,
        input.lastItemUrl ?? null,
        input.lastItemPublishedAt ?? null,
        input.lastPolledAt ?? null,
      ],
    );

    const row = rows[0];
    return row ? this.mapFeedRow(row) : null;
  }

  async findRssFeedById(id: string): Promise<RssFeedRecord | null> {
    const { rows } = await this.pool.query<{
      id: string;
      site_id: string;
      name: string;
      feed_url: string;
      status: "active" | "paused";
      last_item_guid: string | null;
      last_item_title: string | null;
      last_item_url: string | null;
      last_item_published_at: string | null;
      last_polled_at: string | null;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM rss_feeds WHERE id = $1 LIMIT 1`, [id]);
    const row = rows[0];
    return row ? this.mapFeedRow(row) : null;
  }

  async listRssFeeds(filters: { siteId?: string; status?: "active" | "paused"; limit: number; offset: number }): Promise<{ items: RssFeedRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.siteId) {
      params.push(filters.siteId);
      where.push(`site_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const listParams = [...params, filters.limit, filters.offset];
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<{
        id: string;
        site_id: string;
        name: string;
        feed_url: string;
        status: "active" | "paused";
        last_item_guid: string | null;
        last_item_title: string | null;
        last_item_url: string | null;
        last_item_published_at: string | null;
        last_polled_at: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT * FROM rss_feeds ${whereClause} ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      ),
      this.pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM rss_feeds ${whereClause}`, params),
    ]);

    return {
      items: itemsResult.rows.map((row) => this.mapFeedRow(row)),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async deleteRssFeed(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM rss_feeds WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapEventRow(row: {
    id: string;
    site_id: string;
    subscriber_id: string | null;
    campaign_id: string | null;
    trigger_event: string;
    payload: unknown;
    status: string;
    error_message: string | null;
    executed_at: string | null;
    created_at: string;
    updated_at: string;
  }): WorkflowEventRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      subscriberId: row.subscriber_id,
      campaignId: row.campaign_id,
      triggerEvent: row.trigger_event as AutomationTriggerEvent,
      payload: typeof row.payload === "string" ? (JSON.parse(row.payload) as Record<string, unknown>) : (row.payload as Record<string, unknown>),
      status: row.status as WorkflowEventRecord["status"],
      errorMessage: row.error_message,
      executedAt: row.executed_at ? new Date(row.executed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapTagRow(row: {
    id: string;
    subscriber_id: string;
    tag: string;
    created_at: string;
    updated_at: string;
  }): SubscriberTagRecord {
    return {
      id: row.id,
      subscriberId: row.subscriber_id,
      tag: row.tag,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapFeedRow(row: {
    id: string;
    site_id: string;
    name: string;
    feed_url: string;
    status: "active" | "paused";
    last_item_guid: string | null;
    last_item_title: string | null;
    last_item_url: string | null;
    last_item_published_at: string | null;
    last_polled_at: string | null;
    created_at: string;
    updated_at: string;
  }): RssFeedRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      feedUrl: row.feed_url,
      status: row.status,
      lastItemGuid: row.last_item_guid,
      lastItemTitle: row.last_item_title,
      lastItemUrl: row.last_item_url,
      lastItemPublishedAt: row.last_item_published_at ? new Date(row.last_item_published_at) : null,
      lastPolledAt: row.last_polled_at ? new Date(row.last_polled_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
