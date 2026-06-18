import type { MobileDeviceRecord, MobilePushCredentialsRecord, MobilePushDeliveryStatus, MobilePushNotificationPayload } from "./mobile-push.types";

export interface MobilePushDeliveryEventInput {
  siteId: string;
  mobileDeviceId: string | null;
  platform: "ios" | "android";
  deviceToken: string;
  status: MobilePushDeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: MobilePushNotificationPayload;
}

export interface MobilePushRepository {
  findCredentials(siteId: string): Promise<MobilePushCredentialsRecord | null>;
  listEligibleDevices(siteId: string, platform: "ios" | "android" | "all"): Promise<MobileDeviceRecord[]>;
  recordDeliveryEvent(input: MobilePushDeliveryEventInput): Promise<void>;
  markDeviceExpired(deviceId: string): Promise<void>;
}
