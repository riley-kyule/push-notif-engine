import type { MobilePushCredentialsRecord } from "./mobile-push.types";

export interface UpsertMobileCredentialsInput {
  siteId: string;
  apnsKeyId: string | null;
  apnsTeamId: string | null;
  apnsBundleId: string | null;
  apnsPrivateKey: string | null;
  fcmProjectId: string | null;
  fcmClientEmail: string | null;
  fcmPrivateKey: string | null;
}

export interface MobileCredentialsRepository {
  upsert(input: UpsertMobileCredentialsInput): Promise<MobilePushCredentialsRecord>;
  findBySiteId(siteId: string): Promise<MobilePushCredentialsRecord | null>;
}
