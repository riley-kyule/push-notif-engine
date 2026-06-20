import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type {
  AutomationAction,
  AutomationButton,
  AutomationEventRecord,
  AutomationListFilters,
  AutomationListResult,
  AutomationRecord,
  AutomationTriggerEvent,
} from "./automations.types";
import type { AutomationsRepository, CreateAutomationInput, UpdateAutomationInput } from "./automations.repository";

interface DbAutomationRow {
  id: string;
  site_id: string;
  name: string;
  trigger_event: string;
  actions: unknown;
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

function decodeActions(value: unknown): AutomationAction[] {
  if (Array.isArray(value)) {
    return value as AutomationAction[];
  }

  if (typeof value === "string" && value.length > 0) {
    return decodeActions(JSON.parse(value) as unknown);
  }

  return [];
}

function encodeActions(actions: AutomationAction[]): string {
  return JSON.stringify(actions);
}

@Injectable()
export class PostgresAutomationsRepository implements AutomationsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateAutomationInput): Promise<AutomationRecord> {
    const { rows } = await this.pool.query<DbAutomationRow>(
      `
      INSERT INTO automations (
        site_id, name, trigger_event, actions, title, message, url, image_url, icon_url, buttons, status
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::jsonb, $11)
      RETURNING *
      `,
      [
        input.siteId,
        input.name,
        input.triggerEvent,
        encodeActions(input.actions),
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
          actions = COALESCE($4::jsonb, actions),
          title = COALESCE($5, title),
          message = COALESCE($6, message),
          url = COALESCE($7, url),
          image_url = COALESCE($8, image_url),
          icon_url = COALESCE($9, icon_url),
          buttons = COALESCE($10::jsonb, buttons),
          status = COALESCE($11, status),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        input.name ?? null,
        input.triggerEvent ?? null,
        input.actions ? encodeActions(input.actions) : null,
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
      actions: decodeActions(row.actions),
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

  async recordEvent(input: {
    siteId: string;
    subscriberId?: string | null;
    campaignId?: string | null;
    triggerEvent: AutomationTriggerEvent;
    payload: Record<string, unknown>;
  }): Promise<AutomationEventRecord> {
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
      [
        input.siteId,
        input.subscriberId ?? null,
        input.campaignId ?? null,
        input.triggerEvent,
        JSON.stringify(input.payload),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to record automation event");
    }

    return {
      id: row.id,
      siteId: row.site_id,
      subscriberId: row.subscriber_id,
      campaignId: row.campaign_id,
      triggerEvent: row.trigger_event as AutomationTriggerEvent,
      payload: typeof row.payload === "string" ? (JSON.parse(row.payload) as Record<string, unknown>) : (row.payload as Record<string, unknown>),
      status: row.status as AutomationEventRecord["status"],
      errorMessage: row.error_message,
      executedAt: row.executed_at ? new Date(row.executed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async markEventCompleted(eventId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE automation_events
      SET status = 'completed',
          executed_at = NOW(),
          error_message = NULL,
          updated_at = NOW()
      WHERE id = $1
      `,
      [eventId],
    );
  }

  async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE automation_events
      SET status = 'failed',
          error_message = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [eventId, errorMessage],
    );
  }
}
