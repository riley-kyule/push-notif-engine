import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";

export interface AuditLogEntry {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRecord {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogPage {
  items: AuditLogRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogQuery {
  limit: number;
  offset: number;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.actorUserId ?? null,
        entry.action,
        entry.targetType ?? null,
        entry.targetId ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  }

  async list(query: AuditLogQuery): Promise<AuditLogPage> {
    const limit = Math.max(1, Math.min(query.limit, 100));
    const offset = Math.max(0, query.offset);

    const [itemsResult, totalResult] = await Promise.all([
      this.pool.query<{
        id: string;
        actor_user_id: string | null;
        actor_email: string | null;
        actor_name: string | null;
        actor_role: string | null;
        action: string;
        target_type: string | null;
        target_id: string | null;
        metadata: Record<string, unknown> | string;
        created_at: string;
        updated_at: string;
      }>(
        `
        SELECT
          a.id,
          a.actor_user_id,
          u.email AS actor_email,
          u.name AS actor_name,
          r.slug AS actor_role,
          a.action,
          a.target_type,
          a.target_id,
          a.metadata,
          a.created_at,
          a.updated_at
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_user_id
        LEFT JOIN roles r ON r.id = u.role_id
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      ),
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM audit_logs"),
    ]);

    const items: AuditLogRecord[] = itemsResult.rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: typeof row.metadata === "string" ? (JSON.parse(row.metadata) as Record<string, unknown>) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      items,
      total: Number(totalResult.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }
}
