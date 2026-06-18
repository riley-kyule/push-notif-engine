export interface BrowserPushNotificationPayload {
  title: string;
  body: string;
  url: string;
  icon?: string | null;
  image?: string | null;
  deliveryId?: string | null;
  ackUrl?: string | null;
}

export interface BrowserPushDispatchRequest {
  siteId: string;
  notification: BrowserPushNotificationPayload;
  campaignId?: string | null;
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
