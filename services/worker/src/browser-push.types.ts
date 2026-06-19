export interface BrowserPushNotificationPayload {
  title: string;
  body: string;
  url: string;
  icon?: string | null;
  image?: string | null;
  deliveryId?: string | null;
  ackUrl?: string | null;
  clickUrl?: string | null;
}

export interface BrowserPushJobPayload {
  siteId: string;
  campaignId?: string | null;
  segmentId?: string | null;
  subscriberId?: string | null;
  notification: BrowserPushNotificationPayload;
  enqueuedAt: string;
}

export type BrowserPushDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "expired";
