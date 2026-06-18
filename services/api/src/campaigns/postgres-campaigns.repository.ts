import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { CampaignButton, CampaignListFilters, CampaignListResult, CampaignRecord } from "./campaigns.types";
import type { CampaignsRepository, CreateCampaignInput, UpdateCampaignInput } from "./campaigns.repository";

interface DbCampaignRow {
  id: string;
  site_id: string;
  name: string;
  channel: string;
  type: string;
  title: string;
  message: string;
  url: string;
  image_url: string | null;
  icon_url: string | null;
  buttons: unknown;
  expiration_at: string | null;
  status: string;
  scheduled_at: string | null;
  timezone: string | null;
  recurrence_type: string | null;
  recurrence_interval: number | null;
  recurrence_until_at: string | null;
  cloned_from_campaign_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function decodeButtons(value: unknown): CampaignButton[] {
  if (Array.isArray(value)) {
    return value.map((button) => ({
      label: String((button as { label?: unknown }).label ?? ""),
      url: String((button as { url?: unknown }).url ?? ""),
    }));
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = JSON.parse(value) as unknown;
    return decodeButtons(parsed);
  }

  return [];
}

function encodeButtons(buttons: CampaignButton[]): string {
  return JSON.stringify(buttons);
}

@Injectable()
export class PostgresCampaignsRepository implements CampaignsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateCampaignInput): Promise<CampaignRecord> {
    const { rows } = await this.pool.query<DbCampaignRow>(
      `
      INSERT INTO campaigns (
        site_id, name, channel, type, title, message, url, image_url, icon_url, buttons,
        expiration_at, status, scheduled_at, timezone, recurrence_type, recurrence_interval,
        recurrence_until_at, cloned_from_campaign_id, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
      `,
      [
        input.siteId,
        input.name,
        input.channel,
        input.type,
        input.title,
        input.message,
        input.url,
        input.imageUrl,
        input.iconUrl,
        encodeButtons(input.buttons),
        input.expirationAt,
        input.status,
        input.scheduledAt,
        input.timezone,
        input.recurrenceType,
        input.recurrenceInterval,
        input.recurrenceUntilAt,
        input.clonedFromCampaignId,
        input.sentAt,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create campaign");
    }

    return this.mapRow(row);
  }

  async update(id: string, input: UpdateCampaignInput): Promise<CampaignRecord | null> {
    const { rows } = await this.pool.query<DbCampaignRow>(
      `
      UPDATE campaigns
      SET name = COALESCE($2, name),
          channel = COALESCE($3, channel),
          type = COALESCE($4, type),
          title = COALESCE($5, title),
          message = COALESCE($6, message),
          url = COALESCE($7, url),
          image_url = COALESCE($8, image_url),
          icon_url = COALESCE($9, icon_url),
          buttons = COALESCE($10::jsonb, buttons),
          expiration_at = COALESCE($11, expiration_at),
          status = COALESCE($12, status),
          scheduled_at = COALESCE($13, scheduled_at),
          timezone = COALESCE($14, timezone),
          recurrence_type = COALESCE($15, recurrence_type),
          recurrence_interval = COALESCE($16, recurrence_interval),
          recurrence_until_at = COALESCE($17, recurrence_until_at),
          cloned_from_campaign_id = COALESCE($18, cloned_from_campaign_id),
          sent_at = COALESCE($19, sent_at),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        input.name ?? null,
        input.channel ?? null,
        input.type ?? null,
        input.title ?? null,
        input.message ?? null,
        input.url ?? null,
        input.imageUrl ?? null,
        input.iconUrl ?? null,
        input.buttons ? encodeButtons(input.buttons) : null,
        input.expirationAt ?? null,
        input.status ?? null,
        input.scheduledAt ?? null,
        input.timezone ?? null,
        input.recurrenceType ?? null,
        input.recurrenceInterval ?? null,
        input.recurrenceUntilAt ?? null,
        input.clonedFromCampaignId ?? null,
        input.sentAt ?? null,
      ],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findById(id: string): Promise<CampaignRecord | null> {
    const { rows } = await this.pool.query<DbCampaignRow>(
      `
      SELECT *
      FROM campaigns
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      DELETE FROM campaigns
      WHERE id = $1
      `,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async list(filters: CampaignListFilters): Promise<CampaignListResult> {
    const query: string[] = [
      `SELECT *`,
      `FROM campaigns`,
    ];
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.siteId) {
      params.push(filters.siteId);
      where.push(`site_id = $${params.length}`);
    }

    if (filters.type) {
      params.push(filters.type);
      where.push(`type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (where.length > 0) {
      query.push(`WHERE ${where.join(" AND ")}`);
    }

    query.push(`ORDER BY created_at DESC`);
    params.push(filters.limit, filters.offset);
    query.push(`LIMIT $${params.length - 1} OFFSET $${params.length}`);

    const countQuery = [`SELECT COUNT(*)::int AS total FROM campaigns`];
    if (where.length > 0) {
      countQuery.push(`WHERE ${where.join(" AND ")}`);
    }

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<DbCampaignRow>(query.join(" "), params),
      this.pool.query<{ total: number }>(countQuery.join(" "), params.slice(0, params.length - 2)),
    ]);

    return {
      items: itemsResult.rows.map((row) => this.mapRow(row)),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  private mapRow(row: DbCampaignRow): CampaignRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      channel: row.channel as CampaignRecord["channel"],
      type: row.type as CampaignRecord["type"],
      title: row.title,
      message: row.message,
      url: row.url,
      imageUrl: row.image_url,
      iconUrl: row.icon_url,
      buttons: decodeButtons(row.buttons),
      expirationAt: row.expiration_at ? new Date(row.expiration_at) : null,
      status: row.status as CampaignRecord["status"],
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
      timezone: row.timezone,
      recurrenceType: row.recurrence_type as CampaignRecord["recurrenceType"],
      recurrenceInterval: row.recurrence_interval,
      recurrenceUntilAt: row.recurrence_until_at ? new Date(row.recurrence_until_at) : null,
      clonedFromCampaignId: row.cloned_from_campaign_id,
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
