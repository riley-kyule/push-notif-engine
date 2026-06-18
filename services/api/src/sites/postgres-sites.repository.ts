import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { SiteListFilters, SiteListResult, SiteRecord, SiteStatus } from "./sites.types";
import type { CreateSiteInput, SitesRepository, UpdateSiteInput } from "./sites.repository";

interface DbSiteRow {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  platform: string;
  logo_url: string | null;
  vapid_subject: string | null;
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  status: SiteStatus;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresSitesRepository implements SitesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateSiteInput): Promise<SiteRecord> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      INSERT INTO sites (name, url, country, language, platform, logo_url, vapid_subject, vapid_public_key, vapid_private_key, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, url, country, language, platform, logo_url, vapid_subject, vapid_public_key, vapid_private_key, status, created_at, updated_at
      `,
      [
        input.name,
        input.url,
        input.country,
        input.language,
        input.platform,
        input.logoUrl,
        input.vapidSubject,
        input.vapidPublicKey,
        input.vapidPrivateKey,
        input.status,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create site");
    }

    return this.mapRow(row);
  }

  async update(id: string, input: UpdateSiteInput): Promise<SiteRecord | null> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      UPDATE sites
      SET name = COALESCE($2, name),
          url = COALESCE($3, url),
          country = COALESCE($4, country),
          language = COALESCE($5, language),
          platform = COALESCE($6, platform),
          logo_url = COALESCE($7, logo_url),
          vapid_subject = COALESCE($8, vapid_subject),
          vapid_public_key = COALESCE($9, vapid_public_key),
          vapid_private_key = COALESCE($10, vapid_private_key),
          status = COALESCE($11, status),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, url, country, language, platform, logo_url, vapid_subject, vapid_public_key, vapid_private_key, status, created_at, updated_at
      `,
      [
        id,
        input.name ?? null,
        input.url ?? null,
        input.country ?? null,
        input.language ?? null,
        input.platform ?? null,
        input.logoUrl ?? null,
        input.vapidSubject ?? null,
        input.vapidPublicKey ?? null,
        input.vapidPrivateKey ?? null,
        input.status ?? null,
      ],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findById(id: string): Promise<SiteRecord | null> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      SELECT id, name, url, country, language, platform, logo_url, vapid_subject, vapid_public_key, vapid_private_key, status, created_at, updated_at
      FROM sites
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async list(filters: SiteListFilters): Promise<SiteListResult> {
    const query: string[] = [
      `SELECT id, name, url, country, language, platform, logo_url, vapid_subject, vapid_public_key, vapid_private_key, status, created_at, updated_at`,
      `FROM sites`,
    ];
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(`(name ILIKE $${params.length} OR url ILIKE $${params.length})`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.country) {
      params.push(filters.country);
      where.push(`country = $${params.length}`);
    }

    if (filters.language) {
      params.push(filters.language);
      where.push(`language = $${params.length}`);
    }

    if (where.length > 0) {
      query.push(`WHERE ${where.join(" AND ")}`);
    }

    query.push(`ORDER BY created_at DESC`);
    params.push(filters.limit, filters.offset);
    query.push(`LIMIT $${params.length - 1} OFFSET $${params.length}`);

    const countQuery = [`SELECT COUNT(*)::int AS total FROM sites`];
    if (where.length > 0) {
      countQuery.push(`WHERE ${where.join(" AND ")}`);
    }

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<DbSiteRow>(query.join(" "), params),
      this.pool.query<{ total: number }>(countQuery.join(" "), params.slice(0, params.length - 2)),
    ]);

    return {
      items: itemsResult.rows.map((row) => this.mapRow(row)),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  private mapRow(row: DbSiteRow): SiteRecord {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      country: row.country,
      language: row.language,
      platform: row.platform,
      logoUrl: row.logo_url,
      vapidSubject: row.vapid_subject,
      vapidPublicKey: row.vapid_public_key,
      vapidPrivateKey: row.vapid_private_key,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
