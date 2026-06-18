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
}
