import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";

export type BackupProvider = "dropbox" | "google_drive";
export type BackupFrequency = "daily" | "weekly" | "monthly";
export type BackupRunStatus = "running" | "completed" | "failed";
export type BackupRunTrigger = "manual" | "scheduled";

export interface BackupConnectionRecord {
  id: string;
  provider: BackupProvider;
  accountLabel: string | null;
  encryptedRefreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  autoBackupEnabled: boolean;
  frequency: BackupFrequency;
  nextBackupDueAt: Date | null;
  connectedAt: Date;
  updatedAt: Date;
}

export interface BackupRunRecord {
  id: string;
  provider: BackupProvider;
  status: BackupRunStatus;
  trigger: BackupRunTrigger;
  fileName: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

interface DbConnectionRow {
  id: string;
  provider: BackupProvider;
  account_label: string | null;
  encrypted_refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  auto_backup_enabled: boolean;
  frequency: BackupFrequency;
  next_backup_due_at: string | null;
  connected_at: string;
  updated_at: string;
}

interface DbRunRow {
  id: string;
  provider: BackupProvider;
  status: BackupRunStatus;
  trigger: BackupRunTrigger;
  file_name: string | null;
  size_bytes: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

function mapConnection(row: DbConnectionRow): BackupConnectionRecord {
  return {
    id: row.id,
    provider: row.provider,
    accountLabel: row.account_label,
    encryptedRefreshToken: row.encrypted_refresh_token,
    accessToken: row.access_token,
    accessTokenExpiresAt: row.access_token_expires_at ? new Date(row.access_token_expires_at) : null,
    autoBackupEnabled: row.auto_backup_enabled,
    frequency: row.frequency,
    nextBackupDueAt: row.next_backup_due_at ? new Date(row.next_backup_due_at) : null,
    connectedAt: new Date(row.connected_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRun(row: DbRunRow): BackupRunRecord {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    trigger: row.trigger,
    fileName: row.file_name,
    sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
    errorMessage: row.error_message,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

@Injectable()
export class BackupRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async upsertConnection(input: {
    provider: BackupProvider;
    encryptedRefreshToken: string;
    accessToken: string | null;
    accessTokenExpiresAt: Date | null;
    accountLabel: string | null;
  }): Promise<BackupConnectionRecord> {
    const { rows } = await this.pool.query<DbConnectionRow>(
      `
      INSERT INTO backup_connections (provider, encrypted_refresh_token, access_token, access_token_expires_at, account_label)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (provider) DO UPDATE SET
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        access_token = EXCLUDED.access_token,
        access_token_expires_at = EXCLUDED.access_token_expires_at,
        account_label = EXCLUDED.account_label,
        updated_at = NOW()
      RETURNING *
      `,
      [input.provider, input.encryptedRefreshToken, input.accessToken, input.accessTokenExpiresAt, input.accountLabel],
    );

    return mapConnection(rows[0]!);
  }

  async findConnection(provider: BackupProvider): Promise<BackupConnectionRecord | null> {
    const { rows } = await this.pool.query<DbConnectionRow>(
      `SELECT * FROM backup_connections WHERE provider = $1 LIMIT 1`,
      [provider],
    );

    return rows[0] ? mapConnection(rows[0]) : null;
  }

  async listConnections(): Promise<BackupConnectionRecord[]> {
    const { rows } = await this.pool.query<DbConnectionRow>(`SELECT * FROM backup_connections ORDER BY provider ASC`);
    return rows.map(mapConnection);
  }

  async updateAccessToken(provider: BackupProvider, accessToken: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE backup_connections SET access_token = $2, access_token_expires_at = $3, updated_at = NOW() WHERE provider = $1`,
      [provider, accessToken, expiresAt],
    );
  }

  async updateAutoBackupSettings(
    provider: BackupProvider,
    input: { enabled: boolean; frequency: BackupFrequency },
  ): Promise<BackupConnectionRecord | null> {
    const { rows } = await this.pool.query<DbConnectionRow>(
      `
      UPDATE backup_connections
      SET auto_backup_enabled = $2,
          frequency = $3,
          next_backup_due_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE provider = $1
      RETURNING *
      `,
      [provider, input.enabled, input.frequency],
    );

    return rows[0] ? mapConnection(rows[0]) : null;
  }

  async advanceNextBackupDueAt(provider: BackupProvider): Promise<void> {
    await this.pool.query(
      `
      UPDATE backup_connections
      SET next_backup_due_at = NOW() + CASE frequency
            WHEN 'daily' THEN INTERVAL '1 day'
            WHEN 'weekly' THEN INTERVAL '7 days'
            ELSE INTERVAL '30 days'
          END,
          updated_at = NOW()
      WHERE provider = $1
      `,
      [provider],
    );
  }

  async findDueConnections(asOf: Date): Promise<BackupConnectionRecord[]> {
    const { rows } = await this.pool.query<DbConnectionRow>(
      `SELECT * FROM backup_connections WHERE auto_backup_enabled = true AND next_backup_due_at <= $1`,
      [asOf],
    );

    return rows.map(mapConnection);
  }

  async deleteConnection(provider: BackupProvider): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM backup_connections WHERE provider = $1`, [provider]);
    return (result.rowCount ?? 0) > 0;
  }

  async createRun(provider: BackupProvider, trigger: BackupRunTrigger): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO backup_runs (provider, status, trigger) VALUES ($1, 'running', $2) RETURNING id`,
      [provider, trigger],
    );

    return rows[0]!.id;
  }

  async markRunCompleted(id: string, input: { fileName: string; sizeBytes: number }): Promise<void> {
    await this.pool.query(
      `UPDATE backup_runs SET status = 'completed', file_name = $2, size_bytes = $3, completed_at = NOW() WHERE id = $1`,
      [id, input.fileName, input.sizeBytes],
    );
  }

  async markRunFailed(id: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `UPDATE backup_runs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`,
      [id, errorMessage],
    );
  }

  async findRunById(id: string): Promise<BackupRunRecord | null> {
    const { rows } = await this.pool.query<DbRunRow>(`SELECT * FROM backup_runs WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ? mapRun(rows[0]) : null;
  }

  async listRuns(limit: number): Promise<BackupRunRecord[]> {
    const { rows } = await this.pool.query<DbRunRow>(
      `SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );

    return rows.map(mapRun);
  }
}
