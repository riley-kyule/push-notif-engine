import crypto from "node:crypto";

import type {
  SubscribersRepository,
  UpsertSubscriberInput,
  UpdateSubscriberStatusInput,
  UpsertSubscriberResult,
} from "./subscribers.repository";
import type { SubscriberListFilters, SubscriberListResult, SubscriberRecord } from "./subscribers.types";

export class InMemorySubscribersRepository implements SubscribersRepository {
  private readonly subscribers = new Map<string, SubscriberRecord>();

  async upsert(input: UpsertSubscriberInput): Promise<UpsertSubscriberResult> {
    const existing = await this.findBySiteAndEndpoint(input.siteId, input.subscriptionEndpoint);
    if (existing) {
      const updated: SubscriberRecord = {
        ...existing,
        browser: input.browser,
        deviceType: input.deviceType,
        country: input.country,
        language: input.language,
        status: input.status,
        p256dhKey: input.p256dhKey,
        authKey: input.authKey,
        lastSeenAt: input.lastSeenAt ?? existing.lastSeenAt,
        updatedAt: new Date(),
      };
      this.subscribers.set(updated.id, updated);
      return { subscriber: updated, isNew: false };
    }

    const now = new Date();
    const subscriber: SubscriberRecord = {
      id: crypto.randomUUID(),
      ...input,
      p256dhKey: input.p256dhKey,
      authKey: input.authKey,
      lastSeenAt: input.lastSeenAt,
      createdAt: now,
      updatedAt: now,
    };
    this.subscribers.set(subscriber.id, subscriber);
    return { subscriber, isNew: true };
  }

  async findById(id: string): Promise<SubscriberRecord | null> {
    return this.subscribers.get(id) ?? null;
  }

  async findBySiteAndEndpoint(siteId: string, subscriptionEndpoint: string): Promise<SubscriberRecord | null> {
    return (
      Array.from(this.subscribers.values()).find(
        (subscriber) => subscriber.siteId === siteId && subscriber.subscriptionEndpoint === subscriptionEndpoint,
      ) ?? null
    );
  }

  async updateStatus(id: string, input: UpdateSubscriberStatusInput): Promise<SubscriberRecord | null> {
    const existing = this.subscribers.get(id);
    if (!existing) {
      return null;
    }

    const updated: SubscriberRecord = {
      ...existing,
      status: input.status,
      lastSeenAt: input.lastSeenAt ?? existing.lastSeenAt,
      updatedAt: new Date(),
    };
    this.subscribers.set(id, updated);
    return updated;
  }

  async list(filters: SubscriberListFilters): Promise<SubscriberListResult> {
    const all = Array.from(this.subscribers.values()).filter((subscriber) => {
      if (filters.siteId && subscriber.siteId !== filters.siteId) return false;
      if (filters.status && subscriber.status !== filters.status) return false;
      if (filters.browser && subscriber.browser !== filters.browser) return false;
      if (filters.deviceType && subscriber.deviceType !== filters.deviceType) return false;
      if (filters.country && subscriber.country !== filters.country) return false;
      if (filters.language && subscriber.language !== filters.language) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          subscriber.subscriptionEndpoint.toLowerCase().includes(search) ||
          subscriber.browser.toLowerCase().includes(search)
        );
      }
      return true;
    });

    return {
      items: all.slice(filters.offset, filters.offset + filters.limit),
      total: all.length,
    };
  }
}
