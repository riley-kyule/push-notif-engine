import crypto from "node:crypto";

import type { MobileDeviceCountSummary, MobileDevicesRepository, RegisterMobileDeviceInput, UpdateMobileDeviceStatusInput, UpdateMobileDeviceTokenInput } from "./mobile-devices.repository";
import type { MobileDeviceRecord, MobilePlatform } from "./mobile-push.types";

export class InMemoryMobileDevicesRepository implements MobileDevicesRepository {
  private readonly items = new Map<string, MobileDeviceRecord>();

  async register(input: RegisterMobileDeviceInput): Promise<MobileDeviceRecord> {
    const existing = await this.findBySiteAndToken(input.siteId, input.platform, input.deviceToken);
    const now = new Date();
    const record: MobileDeviceRecord = existing
      ? {
          ...existing,
          country: input.country,
          language: input.language,
          status: input.status,
          lastSeenAt: input.lastSeenAt ?? existing.lastSeenAt,
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          siteId: input.siteId,
          platform: input.platform,
          deviceToken: input.deviceToken,
          country: input.country,
          language: input.language,
          status: input.status,
          lastSeenAt: input.lastSeenAt,
          createdAt: now,
          updatedAt: now,
        };

    this.items.set(record.id, record);
    return record;
  }

  async findBySiteAndToken(siteId: string, platform: MobilePlatform, deviceToken: string): Promise<MobileDeviceRecord | null> {
    return (
      Array.from(this.items.values()).find(
        (item) => item.siteId === siteId && item.platform === platform && item.deviceToken === deviceToken,
      ) ?? null
    );
  }

  async findById(id: string): Promise<MobileDeviceRecord | null> {
    return this.items.get(id) ?? null;
  }

  async refreshToken(siteId: string, platform: MobilePlatform, currentDeviceToken: string, nextDeviceToken: string): Promise<MobileDeviceRecord | null> {
    const existing = await this.findBySiteAndToken(siteId, platform, currentDeviceToken);
    if (!existing) {
      return null;
    }

    const updated: MobileDeviceRecord = {
      ...existing,
      deviceToken: nextDeviceToken,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };

    this.items.delete(existing.id);
    this.items.set(updated.id, updated);
    return updated;
  }

  async updateStatus(id: string, input: UpdateMobileDeviceStatusInput): Promise<MobileDeviceRecord | null> {
    const existing = this.items.get(id);
    if (!existing) {
      return null;
    }

    const updated: MobileDeviceRecord = {
      ...existing,
      status: input.status,
      lastSeenAt: input.lastSeenAt ?? existing.lastSeenAt,
      updatedAt: new Date(),
    };

    this.items.set(id, updated);
    return updated;
  }

  async listEligible(siteId: string, platform: MobilePlatform | "all"): Promise<MobileDeviceRecord[]> {
    return Array.from(this.items.values()).filter((item) => {
      if (item.siteId !== siteId) return false;
      if (platform !== "all" && item.platform !== platform) return false;
      return item.status === "active";
    });
  }

  async countBySite(siteId: string): Promise<MobileDeviceCountSummary> {
    const summary: MobileDeviceCountSummary = { ios: 0, android: 0, active: 0, invalid: 0, expired: 0 };
    for (const item of this.items.values()) {
      if (item.siteId !== siteId) continue;
      if (item.platform === "ios") summary.ios += 1;
      if (item.platform === "android") summary.android += 1;
      summary[item.status] += 1;
    }

    return summary;
  }
}
