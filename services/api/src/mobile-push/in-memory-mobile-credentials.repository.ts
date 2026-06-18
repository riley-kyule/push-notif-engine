import crypto from "node:crypto";

import type { MobileCredentialsRepository, UpsertMobileCredentialsInput } from "./mobile-credentials.repository";
import type { MobilePushCredentialsRecord } from "./mobile-push.types";

export class InMemoryMobileCredentialsRepository implements MobileCredentialsRepository {
  private readonly items = new Map<string, MobilePushCredentialsRecord>();

  async upsert(input: UpsertMobileCredentialsInput): Promise<MobilePushCredentialsRecord> {
    const existing = await this.findBySiteId(input.siteId);
    const now = new Date();
    const record: MobilePushCredentialsRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      siteId: input.siteId,
      apnsKeyId: input.apnsKeyId,
      apnsTeamId: input.apnsTeamId,
      apnsBundleId: input.apnsBundleId,
      apnsPrivateKey: input.apnsPrivateKey,
      fcmProjectId: input.fcmProjectId,
      fcmClientEmail: input.fcmClientEmail,
      fcmPrivateKey: input.fcmPrivateKey,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.items.set(input.siteId, record);
    return record;
  }

  async findBySiteId(siteId: string): Promise<MobilePushCredentialsRecord | null> {
    return this.items.get(siteId) ?? null;
  }
}
