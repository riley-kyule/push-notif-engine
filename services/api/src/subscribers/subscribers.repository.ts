import type { SubscriberListFilters, SubscriberListResult, SubscriberRecord, SubscriberStatus } from "./subscribers.types";

export interface UpsertSubscriberInput {
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
}

export interface UpdateSubscriberStatusInput {
  status: SubscriberStatus;
  lastSeenAt?: Date | null;
}

export interface SubscribersRepository {
  upsert(input: UpsertSubscriberInput): Promise<SubscriberRecord>;
  findById(id: string): Promise<SubscriberRecord | null>;
  findBySiteAndEndpoint(siteId: string, subscriptionEndpoint: string): Promise<SubscriberRecord | null>;
  updateStatus(id: string, input: UpdateSubscriberStatusInput): Promise<SubscriberRecord | null>;
  list(filters: SubscriberListFilters): Promise<SubscriberListResult>;
}
