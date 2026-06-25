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

export interface UpsertSubscriberResult {
  subscriber: SubscriberRecord;
  isNew: boolean;
}

export interface SubscribersRepository {
  upsert(input: UpsertSubscriberInput): Promise<UpsertSubscriberResult>;
  findById(id: string): Promise<SubscriberRecord | null>;
  findBySiteAndEndpoint(siteId: string, subscriptionEndpoint: string): Promise<SubscriberRecord | null>;
  updateStatus(id: string, input: UpdateSubscriberStatusInput): Promise<SubscriberRecord | null>;
  list(filters: SubscriberListFilters): Promise<SubscriberListResult>;
  // Marks every currently-active subscriber whose last_seen_at is older than
  // the cutoff as inactive. siteIds === null means every site; an empty
  // array would match nothing, so callers should treat that as "no sites
  // selected" rather than translating it to null.
  markInactiveSince(siteIds: string[] | null, inactiveSinceDays: number): Promise<number>;
}
