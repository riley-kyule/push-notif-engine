import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type {
  SubscribersRepository,
  UpsertSubscriberInput,
  UpdateSubscriberStatusInput,
  UpsertSubscriberResult,
} from "./subscribers.repository";
import type { SubscriberListFilters, SubscriberListResult, SubscriberRecord, SubscriberStatus } from "./subscribers.types";

interface DbSubscriberRow {
  id: string;
  site_id: string;
  browser: string;
  device_type: string;
  country: string;
  language: string;
  subscription_endpoint: string;
  p256dh_key: string | null;
  auth_key: string | null;
  status: SubscriberStatus;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresSubscribersRepository implements SubscribersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async upsert(input: UpsertSubscriberInput): Promise<UpsertSubscriberResult> {
    const { rows } = await this.pool.query<DbSubscriberRow>(
      `
      INSERT INTO subscribers (
        site_id, browser, device_type, country, language, subscription_endpoint, p256dh_key, auth_key, status, last_seen_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (site_id, subscription_endpoint)
      DO UPDATE SET
        browser = EXCLUDED.browser,
        device_type = EXCLUDED.device_type,
        country = EXCLUDED.country,
        language = EXCLUDED.language,
        p256dh_key = EXCLUDED.p256dh_key,
        auth_key = EXCLUDED.auth_key,
        status = EXCLUDED.status,
        last_seen_at = COALESCE(EXCLUDED.last_seen_at, subscribers.last_seen_at),
        updated_at = NOW()
      RETURNING id, site_id, browser, device_type, country, language, subscription_endpoint, p256dh_key, auth_key, status, last_seen_at, created_at, updated_at
      `,
      [
        input.siteId,
        input.browser,
        input.deviceType,
        input.country,
        input.language,
        input.subscriptionEndpoint,
        input.p256dhKey,
        input.authKey,
        input.status,
        input.lastSeenAt,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to upsert subscriber");
    }

    // On a fresh INSERT, created_at and updated_at both default to NOW() in the same
    // transaction and are therefore identical. On a conflict UPDATE, only updated_at
    // is bumped, so it diverges from the original created_at. This is the standard
    // trick for distinguishing insert-vs-update from a single ON CONFLICT statement
    // without a second round-trip.
    const isNew = new Date(row.created_at).getTime() === new Date(row.updated_at).getTime();

    return { subscriber: this.mapRow(row), isNew };
  }

  async findById(id: string): Promise<SubscriberRecord | null> {
    const { rows } = await this.pool.query<DbSubscriberRow>(
      `
      SELECT id, site_id, browser, device_type, country, language, subscription_endpoint, p256dh_key, auth_key, status, last_seen_at, created_at, updated_at
      FROM subscribers
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findBySiteAndEndpoint(siteId: string, subscriptionEndpoint: string): Promise<SubscriberRecord | null> {
    const { rows } = await this.pool.query<DbSubscriberRow>(
      `
      SELECT id, site_id, browser, device_type, country, language, subscription_endpoint, p256dh_key, auth_key, status, last_seen_at, created_at, updated_at
      FROM subscribers
      WHERE site_id = $1 AND subscription_endpoint = $2
      LIMIT 1
      `,
      [siteId, subscriptionEndpoint],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async updateStatus(id: string, input: UpdateSubscriberStatusInput): Promise<SubscriberRecord | null> {
    const { rows } = await this.pool.query<DbSubscriberRow>(
      `
      UPDATE subscribers
      SET status = $2,
          last_seen_at = COALESCE($3, last_seen_at),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, site_id, browser, device_type, country, language, subscription_endpoint, p256dh_key, auth_key, status, last_seen_at, created_at, updated_at
      `,
      [id, input.status, input.lastSeenAt ?? null],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async list(filters: SubscriberListFilters): Promise<SubscriberListResult> {
    const queryParts: string[] = [
      `SELECT id, site_id, browser, device_type, country, language, subscription_endpoint, p256dh_key, auth_key, status, last_seen_at, created_at, updated_at`,
      `FROM subscribers`,
    ];
    const countParts: string[] = [`SELECT COUNT(*)::int AS total FROM subscribers`];
    const where: string[] = [];
    const params: Array<string | number | Date> = [];

    if (filters.siteId) {
      params.push(filters.siteId);
      where.push(`site_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.browser) {
      params.push(filters.browser);
      where.push(`browser = $${params.length}`);
    }

    if (filters.deviceType) {
      params.push(filters.deviceType);
      where.push(`device_type = $${params.length}`);
    }

    if (filters.country) {
      params.push(filters.country);
      where.push(`country = $${params.length}`);
    }

    if (filters.language) {
      params.push(filters.language);
      where.push(`language = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(`(subscription_endpoint ILIKE $${params.length} OR browser ILIKE $${params.length})`);
    }

    if (where.length > 0) {
      const whereClause = `WHERE ${where.join(" AND ")}`;
      queryParts.push(whereClause);
      countParts.push(whereClause);
    }

    queryParts.push(`ORDER BY created_at DESC`);
    params.push(filters.limit, filters.offset);
    queryParts.push(`LIMIT $${params.length - 1} OFFSET $${params.length}`);

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<DbSubscriberRow>(queryParts.join(" "), params),
      this.pool.query<{ total: number }>(countParts.join(" "), params.slice(0, params.length - 2)),
    ]);

    return {
      items: itemsResult.rows.map((row) => this.mapRow(row)),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  private mapRow(row: DbSubscriberRow): SubscriberRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      browser: row.browser,
      deviceType: row.device_type,
      country: row.country,
      language: row.language,
      subscriptionEndpoint: row.subscription_endpoint,
      p256dhKey: row.p256dh_key,
      authKey: row.auth_key,
      status: row.status,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
