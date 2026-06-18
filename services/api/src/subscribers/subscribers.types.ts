export type SubscriberStatus = "active" | "inactive" | "unsubscribed" | "expired";

export interface SubscriberRecord {
  id: string;
  siteId: string;
  browser: string;
  deviceType: string;
  country: string;
  language: string;
  subscriptionEndpoint: string;
  p256dhKey: string | null;
  authKey: string | null;
  status: SubscriberStatus;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriberListFilters {
  siteId?: string;
  search?: string;
  status?: SubscriberStatus;
  browser?: string;
  deviceType?: string;
  country?: string;
  language?: string;
  limit: number;
  offset: number;
}

export interface SubscriberListResult {
  items: SubscriberRecord[];
  total: number;
}
