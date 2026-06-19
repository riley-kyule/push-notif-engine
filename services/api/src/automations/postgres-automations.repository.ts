import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { AutomationButton, AutomationListFilters, AutomationListResult, AutomationRecord, AutomationTriggerEvent } from "./automations.types";
import type { AutomationsRepository, CreateAutomationInput, UpdateAutomationInput } from "./automations.repository";

interface DbAutomationRow {
  id: string;
  site_id: string;
  name: string;
  trigger_event: string;
  title: string;
  message: string;
  url: string;
  image_url: string | null;
  icon_url: string | null;
  buttons: unknown;
  status: string;
  created_at: string;
  updated_at: string;
}

function decodeButtons(value: unknown): AutomationButton[] {
  if (Array.isArray(value)) {
    return value.map((button) => ({
      label: String((button as { label?: unknown }).label ?? ""),
      url: String((button as { url?: unknown }).url ?? ""),
    }));
  }

  if (typeof value === "string" && value.length > 0) {
    return decodeButtons(JSON.parse(value) as unknown);
  }

  return [];
}

function encodeButtons(buttons: AutomationButton[]): string {
  return JSON.stringify(buttons);
}

@Injectable()
export class PostgresAutomationsRepository implements AutomationsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateAutomationInput): Promise<AutomationRecord> {
    const { rows } = await this.pool.query<DbAutomationRow>(
      `
      INSERT INTO automations (
        site_id, name, trigger_event, title, message, url, image_url, icon_url, buttons, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      RETURNING *
      `,
      [
        input.siteId,
        input.name,
        input.triggerEvent,
        input.title,
        input.message,
        input.url,
        input.imageUrl,
        input.iconUrl,
        encodeButtons(input.buttons),
        input.status,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create automation");
    }

    return this.mapRow(row);
  }

  async update(id: string, input: UpdateAutomationInput): Promise<AutomationRecord | null> {
    const { rows } = await this.pool.query<DbAutomationRow>(
      `
      UPDATE automations
      SET name = COALESCE($2, name),
          trigger_event = COALESCE($3, trigger_event),
          title = COALESCE($4, title),
          message = COALESCE($5, message),
          url = COALESCE($6, url),
          image_url = COALESCE($7, image_url),
          icon_url = COALESCE($8, icon_url),
          buttons = COALESCE($9::jsonb, buttons),
          status = COALESCE($10, status),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        input.name ?? null,
        input.triggerEvent ?? null,
        input.title ?? null,
        input.message ?? null,
        input.url ?? null,
        input.imageUrl ?? null,
        input.iconUrl ?? null,
        input.buttons ? encodeButtons(input.buttons) : null,
        input.status ?? null,
      ],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findById(id: string): Promise<AutomationRecord | null> {
    const { rows } = await this.pool.query<DbAutomationRow>(`SELECT * FROM automations WHERE id = $1 LIMIT 1`, [id]);
    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM automations WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async list(filters: AutomationListFilters): Promise<AutomationListResult> {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.siteId) {
      params.push(filters.siteId);
      where.push(`site_id = $${params.length}`);
    }
    if (filters.triggerEvent) {
      params.push(filters.triggerEvent);
      where.push(`trigger_event = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const listParams = [...params, filters.limit, filters.offset];
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<DbAutomationRow>(
        `SELECT * FROM automations ${whereClause} ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      ),
      this.pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM automations ${whereClause}`, params),
    ]);

    return {
      items: itemsResult.rows.map((row) => this.mapRow(row)),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async listActiveByTrigger(siteId: string, triggerEvent: AutomationTriggerEvent): Promise<AutomationRecord[]> {
    const { rows } = await this.pool.query<DbAutomationRow>(
      `
      SELECT * FROM automations
      WHERE site_id = $1
        AND trigger_event = $2
        AND status = 'active'
      ORDER BY created_at ASC
      `,
      [siteId, triggerEvent],
    );

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: DbAutomationRow): AutomationRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      name: row.name,
      triggerEvent: row.trigger_event as AutomationTriggerEvent,
      title: row.title,
      message: row.message,
      url: row.url,
      imageUrl: row.image_url,
      iconUrl: row.icon_url,
      buttons: decodeButtons(row.buttons),
      status: row.status as AutomationRecord["status"],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
