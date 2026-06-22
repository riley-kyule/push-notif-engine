import type { Pool } from "pg";

import type { MobileDeviceRecord, MobilePlatform, MobilePushCredentialsRecord, MobilePushDeliveryStatus, MobilePushNotificationPayload } from "./mobile-push.types";

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

export interface MobilePushDeliveryEventInput {
  siteId: string;
  mobileDeviceId: string | null;
  platform: MobilePlatform;
  deviceToken: string;
  status: MobilePushDeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: MobilePushNotificationPayload;
  jobId?: string | null;
}

export class MobilePushRepository {
  constructor(private readonly pool: Pool) {}

  async findCredentials(siteId: string): Promise<MobilePushCredentialsRecord | null> {
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
    return row
      ? {
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
        }
      : null;
  }

  async listEligibleDevices(siteId: string, platform: MobilePlatform | "all"): Promise<MobileDeviceRecord[]> {
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

    return rows.map((row) => ({
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
    }));
  }

  async recordDeliveryEvent(input: MobilePushDeliveryEventInput): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO mobile_push_events (
        site_id, mobile_device_id, platform, device_token, status, provider_message_id, error_code, error_message, payload,
        job_id, last_attempted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `,
      [
        input.siteId,
        input.mobileDeviceId,
        input.platform,
        input.deviceToken,
        input.status,
        input.providerMessageId,
        input.errorCode,
        input.errorMessage,
        JSON.stringify(input.payload),
        input.jobId ?? null,
      ],
    );
  }

  // Mirrors BrowserPushRepository.findAlreadySentSubscriberIds: lets a BullMQ-retried
  // job skip devices it already delivered to instead of double-sending.
  async findAlreadySentDeviceIds(jobId: string): Promise<Set<string>> {
    const { rows } = await this.pool.query<{ mobile_device_id: string | null }>(
      `
      SELECT mobile_device_id
      FROM mobile_push_events
      WHERE job_id = $1
        AND status = 'sent'
        AND mobile_device_id IS NOT NULL
      `,
      [jobId],
    );

    return new Set(rows.map((row) => row.mobile_device_id).filter((id): id is string => Boolean(id)));
  }

  async markDeviceExpired(deviceId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE mobile_devices
      SET status = 'expired', updated_at = NOW()
      WHERE id = $1
      `,
      [deviceId],
    );
  }
}
