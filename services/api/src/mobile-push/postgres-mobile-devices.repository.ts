import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { MobileDevicesRepository, RegisterMobileDeviceInput, UpdateMobileDeviceStatusInput } from "./mobile-devices.repository";
import type { MobileDeviceRecord, MobilePlatform } from "./mobile-push.types";

interface DbMobileDeviceRow {
  id: string;
  site_id: string;
  platform: MobilePlatform;
  device_token: string;
  country: string | null;
  language: string | null;
  status: "active" | "invalid" | "expired";
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresMobileDevicesRepository implements MobileDevicesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async register(input: RegisterMobileDeviceInput): Promise<MobileDeviceRecord> {
    const { rows } = await this.pool.query<DbMobileDeviceRow>(
      `
      INSERT INTO mobile_devices (site_id, platform, device_token, country, language, status, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (site_id, platform, device_token)
      DO UPDATE SET
        country = EXCLUDED.country,
        language = EXCLUDED.language,
        status = EXCLUDED.status,
        last_seen_at = COALESCE(EXCLUDED.last_seen_at, mobile_devices.last_seen_at),
        updated_at = NOW()
      RETURNING id, site_id, platform, device_token, country, language, status, last_seen_at, created_at, updated_at
      `,
      [input.siteId, input.platform, input.deviceToken, input.country, input.language, input.status, input.lastSeenAt],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to register mobile device");
    }

    return this.mapRow(row);
  }

  async findBySiteAndToken(siteId: string, platform: MobilePlatform, deviceToken: string): Promise<MobileDeviceRecord | null> {
    const { rows } = await this.pool.query<DbMobileDeviceRow>(
      `
      SELECT id, site_id, platform, device_token, country, language, status, last_seen_at, created_at, updated_at
      FROM mobile_devices
      WHERE site_id = $1 AND platform = $2 AND device_token = $3
      LIMIT 1
      `,
      [siteId, platform, deviceToken],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findById(id: string): Promise<MobileDeviceRecord | null> {
    const { rows } = await this.pool.query<DbMobileDeviceRow>(
      `
      SELECT id, site_id, platform, device_token, country, language, status, last_seen_at, created_at, updated_at
      FROM mobile_devices
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async refreshToken(siteId: string, platform: MobilePlatform, currentDeviceToken: string, nextDeviceToken: string): Promise<MobileDeviceRecord | null> {
    const { rows } = await this.pool.query<DbMobileDeviceRow>(
      `
      UPDATE mobile_devices
      SET device_token = $4,
          last_seen_at = NOW(),
          updated_at = NOW()
      WHERE site_id = $1 AND platform = $2 AND device_token = $3
      RETURNING id, site_id, platform, device_token, country, language, status, last_seen_at, created_at, updated_at
      `,
      [siteId, platform, currentDeviceToken, nextDeviceToken],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async updateStatus(id: string, input: UpdateMobileDeviceStatusInput): Promise<MobileDeviceRecord | null> {
    const { rows } = await this.pool.query<DbMobileDeviceRow>(
      `
      UPDATE mobile_devices
      SET status = $2,
          last_seen_at = COALESCE($3, last_seen_at),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, site_id, platform, device_token, country, language, status, last_seen_at, created_at, updated_at
      `,
      [id, input.status, input.lastSeenAt ?? null],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async listEligible(siteId: string, platform: MobilePlatform | "all"): Promise<MobileDeviceRecord[]> {
    const { rows } = await this.pool.query<DbMobileDeviceRow>(
      `
      SELECT id, site_id, platform, device_token, country, language, status, last_seen_at, created_at, updated_at
      FROM mobile_devices
      WHERE site_id = $1
        AND status = 'active'
        AND ($2 = 'all' OR platform = $2)
      ORDER BY created_at ASC
      `,
      [siteId, platform],
    );

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: DbMobileDeviceRow): MobileDeviceRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      platform: row.platform,
      deviceToken: row.device_token,
      country: row.country,
      language: row.language,
      status: row.status,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
