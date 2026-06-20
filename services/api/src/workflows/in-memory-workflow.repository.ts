import { randomUUID } from "node:crypto";

import type { AutomationTriggerEvent } from "../automations/automations.types";
import type { CreateRssFeedInput, RssFeedRecord, SubscriberTagRecord, UpdateRssFeedInput, WorkflowEventRecord } from "./workflow.types";
import type { WorkflowRepository } from "./workflow.repository";

export class InMemoryWorkflowRepository implements WorkflowRepository {
  public readonly events: WorkflowEventRecord[] = [];
  public readonly tags: SubscriberTagRecord[] = [];
  public readonly feeds: RssFeedRecord[] = [];

  async recordEvent(input: {
    siteId: string;
    subscriberId?: string | null;
    campaignId?: string | null;
    triggerEvent: AutomationTriggerEvent;
    payload: Record<string, unknown>;
  }): Promise<WorkflowEventRecord> {
    const now = new Date();
    const event: WorkflowEventRecord = {
      id: randomUUID(),
      siteId: input.siteId,
      subscriberId: input.subscriberId ?? null,
      campaignId: input.campaignId ?? null,
      triggerEvent: input.triggerEvent,
      payload: { ...input.payload },
      status: "pending",
      errorMessage: null,
      executedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.events.push(event);
    return event;
  }

  async markEventCompleted(eventId: string): Promise<void> {
    const event = this.events.find((entry) => entry.id === eventId);
    if (event) {
      event.status = "completed";
      event.executedAt = new Date();
      event.updatedAt = new Date();
      event.errorMessage = null;
    }
  }

  async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    const event = this.events.find((entry) => entry.id === eventId);
    if (event) {
      event.status = "failed";
      event.errorMessage = errorMessage;
      event.updatedAt = new Date();
    }
  }

  async listEvents(filters: { siteId?: string; status?: "pending" | "completed" | "failed"; limit: number; offset: number }): Promise<{ items: WorkflowEventRecord[]; total: number }> {
    const items = this.events
      .filter((entry) => !filters.siteId || entry.siteId === filters.siteId)
      .filter((entry) => !filters.status || entry.status === filters.status)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      items: items.slice(filters.offset, filters.offset + filters.limit),
      total: items.length,
    };
  }

  async addSubscriberTag(subscriberId: string, tag: string): Promise<SubscriberTagRecord> {
    const existing = this.tags.find((entry) => entry.subscriberId === subscriberId && entry.tag === tag);
    if (existing) {
      existing.updatedAt = new Date();
      return existing;
    }

    const now = new Date();
    const record: SubscriberTagRecord = {
      id: randomUUID(),
      subscriberId,
      tag,
      createdAt: now,
      updatedAt: now,
    };
    this.tags.push(record);
    return record;
  }

  async removeSubscriberTag(subscriberId: string, tag: string): Promise<boolean> {
    const index = this.tags.findIndex((entry) => entry.subscriberId === subscriberId && entry.tag === tag);
    if (index < 0) return false;
    this.tags.splice(index, 1);
    return true;
  }

  async listSubscriberTags(subscriberId: string): Promise<SubscriberTagRecord[]> {
    return this.tags.filter((entry) => entry.subscriberId === subscriberId);
  }

  async createRssFeed(input: CreateRssFeedInput): Promise<RssFeedRecord> {
    const now = new Date();
    const record: RssFeedRecord = {
      id: randomUUID(),
      siteId: input.siteId,
      name: input.name,
      feedUrl: input.feedUrl,
      status: input.status,
      lastItemGuid: null,
      lastItemTitle: null,
      lastItemUrl: null,
      lastItemPublishedAt: null,
      lastPolledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.feeds.push(record);
    return record;
  }

  async updateRssFeed(id: string, input: UpdateRssFeedInput): Promise<RssFeedRecord | null> {
    const feed = this.feeds.find((entry) => entry.id === id);
    if (!feed) return null;
    feed.name = input.name ?? feed.name;
    feed.feedUrl = input.feedUrl ?? feed.feedUrl;
    feed.status = input.status ?? feed.status;
    feed.lastItemGuid = input.lastItemGuid === undefined ? feed.lastItemGuid : input.lastItemGuid;
    feed.lastItemTitle = input.lastItemTitle === undefined ? feed.lastItemTitle : input.lastItemTitle;
    feed.lastItemUrl = input.lastItemUrl === undefined ? feed.lastItemUrl : input.lastItemUrl;
    feed.lastItemPublishedAt = input.lastItemPublishedAt === undefined ? feed.lastItemPublishedAt : input.lastItemPublishedAt;
    feed.lastPolledAt = input.lastPolledAt === undefined ? feed.lastPolledAt : input.lastPolledAt;
    feed.updatedAt = new Date();
    return feed;
  }

  async findRssFeedById(id: string): Promise<RssFeedRecord | null> {
    return this.feeds.find((entry) => entry.id === id) ?? null;
  }

  async listRssFeeds(filters: { siteId?: string; status?: "active" | "paused"; limit: number; offset: number }): Promise<{ items: RssFeedRecord[]; total: number }> {
    const items = this.feeds
      .filter((entry) => !filters.siteId || entry.siteId === filters.siteId)
      .filter((entry) => !filters.status || entry.status === filters.status);
    return { items: items.slice(filters.offset, filters.offset + filters.limit), total: items.length };
  }

  async deleteRssFeed(id: string): Promise<boolean> {
    const index = this.feeds.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    this.feeds.splice(index, 1);
    return true;
  }
}
