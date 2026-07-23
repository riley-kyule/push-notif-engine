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

export interface BrowserPushDispatchRequest {
  siteId: string;
  notification: BrowserPushNotificationPayload;
  campaignId?: string | null;
  automationId?: string | null;
  segmentId?: string | null;
  /** Send to exactly this one subscriber instead of the site's full eligible audience. */
  subscriberId?: string | null;
  variants?: BrowserPushVariantPayload[];
  retrySourceEventId?: string | null;
}

export interface BrowserPushJobPayload extends BrowserPushDispatchRequest {
  enqueuedAt: string;
}

export type BrowserPushDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "expired";

export interface BrowserPushDeliveryEventInput {
  siteId: string;
  campaignId?: string | null;
  subscriberId: string | null;
  endpoint: string;
  status: BrowserPushDeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: BrowserPushNotificationPayload;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
}
