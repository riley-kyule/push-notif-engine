import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { MobileCredentialsRepository, UpsertMobileCredentialsInput } from "./mobile-credentials.repository";
import type { MobilePushCredentialsRecord } from "./mobile-push.types";

interface DbMobileCredentialsRow {
  id: string;
  site_id: string;
  apns_key_id: string | null;
  apns_team_id: string | null;
  apns_bundle_id: string | null;
  apns_private_key: string | null;
  fcm_project_id: string | null;
  fcm_client_email: string | null;
  fcm_private_key: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresMobileCredentialsRepository implements MobileCredentialsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async upsert(input: UpsertMobileCredentialsInput): Promise<MobilePushCredentialsRecord> {
    const { rows } = await this.pool.query<DbMobileCredentialsRow>(
      `
      INSERT INTO mobile_push_credentials (
        site_id, apns_key_id, apns_team_id, apns_bundle_id, apns_private_key, fcm_project_id, fcm_client_email, fcm_private_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (site_id)
      DO UPDATE SET
        apns_key_id = EXCLUDED.apns_key_id,
        apns_team_id = EXCLUDED.apns_team_id,
        apns_bundle_id = EXCLUDED.apns_bundle_id,
        apns_private_key = EXCLUDED.apns_private_key,
        fcm_project_id = EXCLUDED.fcm_project_id,
        fcm_client_email = EXCLUDED.fcm_client_email,
        fcm_private_key = EXCLUDED.fcm_private_key,
        updated_at = NOW()
      RETURNING id, site_id, apns_key_id, apns_team_id, apns_bundle_id, apns_private_key, fcm_project_id, fcm_client_email, fcm_private_key, created_at, updated_at
      `,
      [
        input.siteId,
        input.apnsKeyId,
        input.apnsTeamId,
        input.apnsBundleId,
        input.apnsPrivateKey,
        input.fcmProjectId,
        input.fcmClientEmail,
        input.fcmPrivateKey,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to store mobile credentials");
    }

    return this.mapRow(row);
  }

  async findBySiteId(siteId: string): Promise<MobilePushCredentialsRecord | null> {
    const { rows } = await this.pool.query<DbMobileCredentialsRow>(
      `
      SELECT id, site_id, apns_key_id, apns_team_id, apns_bundle_id, apns_private_key, fcm_project_id, fcm_client_email, fcm_private_key, created_at, updated_at
      FROM mobile_push_credentials
      WHERE site_id = $1
      LIMIT 1
      `,
      [siteId],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: DbMobileCredentialsRow): MobilePushCredentialsRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      apnsKeyId: row.apns_key_id,
      apnsTeamId: row.apns_team_id,
      apnsBundleId: row.apns_bundle_id,
      apnsPrivateKey: row.apns_private_key,
      fcmProjectId: row.fcm_project_id,
      fcmClientEmail: row.fcm_client_email,
      fcmPrivateKey: row.fcm_private_key,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
