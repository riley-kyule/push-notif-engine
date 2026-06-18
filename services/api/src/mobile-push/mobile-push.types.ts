export type MobilePlatform = "ios" | "android";

export type MobileDeviceStatus = "active" | "invalid" | "expired";

export interface MobilePushNotificationPayload {
  title: string;
  body: string;
  url: string;
  icon?: string | null;
  image?: string | null;
}

export interface MobilePushJobPayload {
  siteId: string;
  platform: MobilePlatform | "all";
  notification: MobilePushNotificationPayload;
  enqueuedAt: string;
}

export interface MobilePushCredentialsRecord {
  id: string;
  siteId: string;
  apnsKeyId: string | null;
  apnsTeamId: string | null;
  apnsBundleId: string | null;
  apnsPrivateKey: string | null;
  fcmProjectId: string | null;
  fcmClientEmail: string | null;
  fcmPrivateKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MobileDeviceRecord {
  id: string;
  siteId: string;
  platform: MobilePlatform;
  deviceToken: string;
  country: string | null;
  language: string | null;
  status: MobileDeviceStatus;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MobilePushDeliveryStatus = "sent" | "failed" | "expired";
