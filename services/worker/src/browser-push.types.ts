export interface BrowserPushNotificationPayload {
  title: string;
  body: string;
  url: string;
  icon?: string | null;
  image?: string | null;
  deliveryId?: string | null;
  ackUrl?: string | null;
  clickUrl?: string | null;
  variantId?: string | null;
}

export interface BrowserPushVariantPayload {
  id: string;
  title: string;
  body: string;
  url: string;
  weight: number;
}

export interface BrowserPushJobPayload {
  siteId: string;
  campaignId?: string | null;
  automationId?: string | null;
  segmentId?: string | null;
  subscriberId?: string | null;
  variants?: BrowserPushVariantPayload[];
  retrySourceEventId?: string | null;
  notification: BrowserPushNotificationPayload;
  enqueuedAt: string;
}

export type BrowserPushDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "expired";
