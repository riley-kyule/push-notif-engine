import type { MobileDeviceRecord, MobileDeviceStatus, MobilePlatform } from "./mobile-push.types";

export interface RegisterMobileDeviceInput {
  siteId: string;
  platform: MobilePlatform;
  deviceToken: string;
  country: string | null;
  language: string | null;
  status: MobileDeviceStatus;
  lastSeenAt: Date | null;
}

export interface UpdateMobileDeviceTokenInput {
  nextDeviceToken: string;
  lastSeenAt?: Date | null;
}

export interface UpdateMobileDeviceStatusInput {
  status: MobileDeviceStatus;
  lastSeenAt?: Date | null;
}

export interface MobileDeviceCountSummary {
  ios: number;
  android: number;
  active: number;
  invalid: number;
  expired: number;
}

export interface ListMobileDevicesFilter {
  platform?: MobilePlatform;
  status?: MobileDeviceStatus;
  limit: number;
  offset: number;
}

export interface MobileDevicesRepository {
  register(input: RegisterMobileDeviceInput): Promise<MobileDeviceRecord>;
  findBySiteAndToken(siteId: string, platform: MobilePlatform, deviceToken: string): Promise<MobileDeviceRecord | null>;
  findById(id: string): Promise<MobileDeviceRecord | null>;
  refreshToken(siteId: string, platform: MobilePlatform, currentDeviceToken: string, nextDeviceToken: string): Promise<MobileDeviceRecord | null>;
  updateStatus(id: string, input: UpdateMobileDeviceStatusInput): Promise<MobileDeviceRecord | null>;
  listEligible(siteId: string, platform: MobilePlatform | "all"): Promise<MobileDeviceRecord[]>;
  listBySite(siteId: string, filter: ListMobileDevicesFilter): Promise<{ items: MobileDeviceRecord[]; total: number }>;
  countBySite(siteId: string): Promise<MobileDeviceCountSummary>;
}
