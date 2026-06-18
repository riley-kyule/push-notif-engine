import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { SegmentDefinition, SegmentListFilters, SegmentListResult, SegmentRecord, SegmentRule, SegmentStatus } from "./segments.types";
import type { CreateSegmentInput, SegmentsRepository, UpdateSegmentInput } from "./segments.repository";

interface DbSegmentRow {
  id: string;
  site_id: string;
  name: string;
  description: string | null;
  match_mode: "all" | "any";
  rules: SegmentDefinition["rules"];
  status: SegmentStatus;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DbSegmentRow): SegmentRecord {
  return {
    id: row.id,
    siteId: row.site_id,
    name: row.name,
    description: row.description,
    definition: {
      matchMode: row.match_mode,
      rules: row.rules,
    },
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function buildRuleClause(rule: SegmentRule, parameterIndex: number): { clause: string; params: Array<string | number | string[]> } {
  if (rule.field === "lastSeenAt") {
    const days = Number(rule.value);
    const comparator = rule.operator === "withinDays" ? ">=" : "<";
    return {
      clause: `last_seen_at ${comparator} NOW() - ($${parameterIndex}::int * INTERVAL '1 day')`,
      params: [days],
    };
  }

  const columnMap: Record<Exclude<SegmentRule["field"], "lastSeenAt">, string> = {
    country: "country",
    browser: "browser",
    deviceType: "device_type",
    language: "language",
    status: "status",
  };

  const column = columnMap[rule.field];
  if (rule.operator === "is") {
    return { clause: `${column} = $${parameterIndex}`, params: [rule.value as string] };
  }
  if (rule.operator === "isNot") {
    return { clause: `${column} <> $${parameterIndex}`, params: [rule.value as string] };
  }
  if (rule.operator === "in") {
    return { clause: `${column} = ANY($${parameterIndex}::text[])`, params: [rule.value as string[]] };
  }
  if (rule.operator === "notIn") {
    return { clause: `NOT (${column} = ANY($${parameterIndex}::text[]))`, params: [rule.value as string[]] };
  }

  throw new Error(`Unsupported segment rule operator: ${rule.operator}`);
}

function buildSegmentWhereClause(siteId: string, definition: SegmentDefinition): { clause: string; params: Array<string | number | string[]> } {
  const params: Array<string | number | string[]> = [siteId];
  const clauses: string[] = ["site_id = $1"];

  definition.rules.forEach((rule, index) => {
    const built = buildRuleClause(rule, params.length + 1);
    params.push(...built.params);
    clauses.push(built.clause);
  });

  if (definition.rules.length === 0) {
    return { clause: "site_id = $1", params };
  }

  const joiner = definition.matchMode === "any" ? " OR " : " AND ";
  return {
    clause: `site_id = $1 AND (${clauses.slice(1).join(joiner)})`,
    params,
  };
}

@Injectable()
export class PostgresSegmentsRepository implements SegmentsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateSegmentInput): Promise<SegmentRecord> {
    const { rows } = await this.pool.query<DbSegmentRow>(
      `
      INSERT INTO segments (site_id, name, description, match_mode, rules, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, site_id, name, description, match_mode, rules, status, created_at, updated_at
      `,
      [input.siteId, input.name, input.description, input.definition.matchMode, JSON.stringify(input.definition.rules), input.status],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create segment");
    }

    return mapRow(row);
  }

  async update(id: string, input: UpdateSegmentInput): Promise<SegmentRecord | null> {
    const { rows } = await this.pool.query<DbSegmentRow>(
      `
      UPDATE segments
      SET name = $2,
          description = $3,
          match_mode = $4,
          rules = $5::jsonb,
          status = $6,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, site_id, name, description, match_mode, rules, status, created_at, updated_at
      `,
      [
        id,
        input.name ?? "",
        input.description ?? null,
        input.definition?.matchMode ?? "all",
        JSON.stringify(input.definition?.rules ?? []),
        input.status ?? "active",
      ],
    );

    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async findById(id: string): Promise<SegmentRecord | null> {
    const { rows } = await this.pool.query<DbSegmentRow>(
      `
      SELECT id, site_id, name, description, match_mode, rules, status, created_at, updated_at
      FROM segments
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      DELETE FROM segments
      WHERE id = $1
      `,
      [id],
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  async list(filters: SegmentListFilters): Promise<SegmentListResult> {
    const values: Array<string | number | SegmentStatus> = [];
    const where: string[] = [];

    if (filters.siteId) {
      values.push(filters.siteId);
      where.push(`site_id = $${values.length}`);
    }

    if (filters.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const query = `
      SELECT id, site_id, name, description, match_mode, rules, status, created_at, updated_at
      FROM segments
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM segments
      ${whereClause}
    `;

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<DbSegmentRow>(query, [...values, filters.limit, filters.offset]),
      this.pool.query<{ total: number }>(countQuery, values),
    ]);

    return {
      items: itemsResult.rows.map(mapRow),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async estimateReach(siteId: string, definition: SegmentDefinition): Promise<number> {
    const built = buildSegmentWhereClause(siteId, definition);
    const { rows } = await this.pool.query<{ total: number }>(
      `
      SELECT COUNT(*)::int AS total
      FROM subscribers
      WHERE ${built.clause}
      `,
      built.params,
    );

    return rows[0]?.total ?? 0;
  }
}
