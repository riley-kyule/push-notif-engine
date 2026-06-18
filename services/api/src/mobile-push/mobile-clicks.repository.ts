import type { MobilePlatform } from "./mobile-push.types";

export interface RecordMobileClickEventInput {
  siteId: string;
  mobileDeviceId: string | null;
  platform: MobilePlatform;
  deviceToken: string;
  destinationUrl: string;
}

export interface MobileClicksRepository {
  recordClickEvent(input: RecordMobileClickEventInput): Promise<void>;
}
