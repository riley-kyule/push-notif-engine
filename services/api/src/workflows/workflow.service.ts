import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { BrowserPushService } from "../browser-push/browser-push.service";
import { AutomationsService } from "../automations/automations.service";
import type { AutomationAction, AutomationRecord, AutomationTriggerEvent } from "../automations/automations.types";
import { SitesService } from "../sites/sites.service";
import type { WorkflowRepository } from "./workflow.repository";
import type { CreateRssFeedInput, RssFeedRecord, UpdateRssFeedInput, WorkflowActionContext, WorkflowEventRecord } from "./workflow.types";

export const WORKFLOW_REPOSITORY = Symbol("WORKFLOW_REPOSITORY");

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractTagValue(source: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(source);
  if (!match?.[1]) return null;
  return decodeEntities(stripTags(match[1]));
}

function extractAtomLink(source: string): string | null {
  const match = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i.exec(source) ?? /<link[^>]*href="([^"]+)"/i.exec(source);
  return match?.[1] ? decodeEntities(match[1]) : null;
}

function parseFeedItems(xml: string): Array<{ guid: string; title: string; url: string; publishedAt: Date | null; description: string | null }> {
  const rssItems = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomEntries = rssItems.length > 0 ? [] : [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = rssItems.length > 0 ? rssItems : atomEntries;

  return blocks.map((block) => {
    const title = extractTagValue(block, "title") ?? "Untitled";
    const guid = extractTagValue(block, "guid") ?? extractTagValue(block, "id") ?? extractTagValue(block, "link") ?? title;
    const link = extractTagValue(block, "link") ?? extractAtomLink(block) ?? "";
    const publishedAtValue =
      extractTagValue(block, "pubDate") ?? extractTagValue(block, "published") ?? extractTagValue(block, "updated");
    const publishedAt = publishedAtValue ? new Date(publishedAtValue) : null;
    const description = extractTagValue(block, "description") ?? extractTagValue(block, "summary") ?? null;

    return {
      guid,
      title,
      url: link,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      description,
    };
  });
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly sitesService: SitesService,
    private readonly automationsService: AutomationsService,
    private readonly browserPushService: BrowserPushService,
    @Inject(WORKFLOW_REPOSITORY) private readonly repository: WorkflowRepository,
  ) {}

  async recordEvent(input: {
    siteId: string;
    subscriberId?: string | null;
    campaignId?: string | null;
    triggerEvent: AutomationTriggerEvent;
    payload: Record<string, unknown>;
  }): Promise<WorkflowEventRecord> {
    const event = await this.repository.recordEvent(input);
    try {
      await this.executeEvent(event);
      await this.repository.markEventCompleted(event.id);
      return { ...event, status: "completed", executedAt: new Date(), errorMessage: null, updatedAt: new Date() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workflow error";
      await this.repository.markEventFailed(event.id, message);
      this.logger.error(`Failed to execute workflow event ${event.id}`, error as Error);
      return { ...event, status: "failed", errorMessage: message, updatedAt: new Date() };
    }
  }

  async listEvents(filters: { siteId?: string; status?: "pending" | "completed" | "failed"; limit: number; offset: number }) {
    return this.repository.listEvents(filters);
  }

  async handleSubscriberRegistered(subscriber: {
    id: string;
    siteId: string;
    browser: string;
    deviceType: string;
    country: string;
    language: string;
    subscriptionEndpoint: string;
    p256dhKey: string | null;
    authKey: string | null;
    status: string;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<void> {
    await this.recordEvent({
      siteId: subscriber.siteId,
      subscriberId: subscriber.id,
      triggerEvent: "subscriber_registered",
      payload: {
        subscriberId: subscriber.id,
        browser: subscriber.browser,
        deviceType: subscriber.deviceType,
        country: subscriber.country,
        language: subscriber.language,
      },
    });
  }

  async handleSubscriberUnsubscribed(subscriber: {
    id: string;
    siteId: string;
    browser: string;
    deviceType: string;
    country: string;
    language: string;
  }): Promise<void> {
    await this.recordEvent({
      siteId: subscriber.siteId,
      subscriberId: subscriber.id,
      triggerEvent: "subscriber_unsubscribed",
      payload: {
        subscriberId: subscriber.id,
        browser: subscriber.browser,
        deviceType: subscriber.deviceType,
        country: subscriber.country,
        language: subscriber.language,
      },
    });
  }

  async createRssFeed(input: CreateRssFeedInput): Promise<RssFeedRecord> {
    await this.sitesService.getSite(input.siteId);
    return this.repository.createRssFeed(input);
  }

  async listRssFeeds(filters: { siteId?: string; status?: "active" | "paused"; limit: number; offset: number }) {
    return this.repository.listRssFeeds(filters);
  }

  async getRssFeed(id: string): Promise<RssFeedRecord> {
    const feed = await this.repository.findRssFeedById(id);
    if (!feed) {
      throw new NotFoundException("RSS feed not found");
    }
    return feed;
  }

  async updateRssFeed(id: string, input: UpdateRssFeedInput): Promise<RssFeedRecord> {
    const updated = await this.repository.updateRssFeed(id, input);
    if (!updated) {
      throw new NotFoundException("RSS feed not found");
    }
    return updated;
  }

  async deleteRssFeed(id: string): Promise<void> {
    const deleted = await this.repository.deleteRssFeed(id);
    if (!deleted) {
      throw new NotFoundException("RSS feed not found");
    }
  }

  @Cron("*/15 * * * *")
  async pollActiveFeeds(): Promise<void> {
    const feeds = await this.repository.listRssFeeds({ limit: 1000, offset: 0, status: "active" });
    for (const feed of feeds.items) {
      try {
        await this.pollFeed(feed);
      } catch (error) {
        this.logger.error(`Failed to poll RSS feed ${feed.id}`, error as Error);
      }
    }
  }

  async pollFeed(feed: RssFeedRecord): Promise<void> {
    const response = await fetch(feed.feedUrl, {
      headers: {
        "user-agent": "ExoticPushEngine/1.0 (+https://github.com/riley-kyule/push-notif-engine)",
        accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`RSS feed returned HTTP ${response.status}`);
    }

    const xml = await response.text();
    const items = parseFeedItems(xml);
    const latest = items[0];
    if (!latest) {
      await this.repository.updateRssFeed(feed.id, { lastPolledAt: new Date() });
      return;
    }

    if (latest.guid === feed.lastItemGuid) {
      await this.repository.updateRssFeed(feed.id, { lastPolledAt: new Date() });
      return;
    }

    await this.repository.updateRssFeed(feed.id, {
      lastItemGuid: latest.guid,
      lastItemTitle: latest.title,
      lastItemUrl: latest.url,
      lastItemPublishedAt: latest.publishedAt,
      lastPolledAt: new Date(),
    });

    await this.recordEvent({
      siteId: feed.siteId,
      triggerEvent: "rss_item_published",
      payload: {
        feedId: feed.id,
        feedName: feed.name,
        itemGuid: latest.guid,
        itemTitle: latest.title,
        itemUrl: latest.url,
        itemPublishedAt: latest.publishedAt?.toISOString() ?? null,
        itemDescription: latest.description,
      },
    });
  }

  private async executeEvent(event: WorkflowEventRecord): Promise<void> {
    const automations = await this.automationsService.listActiveByTrigger(event.siteId, event.triggerEvent);
    const failures: string[] = [];
    for (const automation of automations) {
      try {
        await this.executeAutomation(automation, {
          siteId: event.siteId,
          subscriberId: event.subscriberId,
          campaignId: event.campaignId,
          triggerEvent: event.triggerEvent,
          payload: event.payload,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown workflow failure";
        failures.push(`automation ${automation.id}: ${message}`);
        this.logger.error(`Automation ${automation.id} failed for event ${event.id}`, error as Error);
      }
    }

    if (failures.length > 0) {
      throw new Error(failures.join("; "));
    }
  }

  private getAutomationActions(automation: AutomationRecord): AutomationAction[] {
    if (automation.actions.length > 0) {
      return automation.actions;
    }

    return [
      {
        type: "send_notification",
        title: automation.title,
        message: automation.message,
        url: automation.url,
        imageUrl: automation.imageUrl,
        iconUrl: automation.iconUrl,
        buttons: automation.buttons,
      },
    ];
  }

  private async executeAutomation(automation: AutomationRecord, context: WorkflowActionContext): Promise<void> {
    for (const action of this.getAutomationActions(automation)) {
      await this.executeAction(automation, action, context);
    }
  }

  private async executeAction(automation: AutomationRecord, action: AutomationAction, context: WorkflowActionContext): Promise<void> {
    if (action.type === "send_notification") {
      await this.browserPushService.dispatch({
        // An "All Sites" automation has automation.siteId === null -- the
        // event itself always belongs to one real site, so dispatch there.
        siteId: context.siteId,
        subscriberId: context.subscriberId ?? null,
        title: action.title,
        body: action.message,
        url: action.url,
        icon: action.iconUrl,
        image: action.imageUrl,
        campaignId: context.campaignId ?? null,
      });
      return;
    }

    if (action.type === "add_tag") {
      if (context.subscriberId) {
        await this.repository.addSubscriberTag(context.subscriberId, action.tag);
      }
      return;
    }

    if (action.type === "remove_tag") {
      if (context.subscriberId) {
        await this.repository.removeSubscriberTag(context.subscriberId, action.tag);
      }
      return;
    }

    const response = await fetch(action.url, {
      method: action.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        automationId: automation.id,
        siteId: automation.siteId,
        triggerEvent: context.triggerEvent,
        subscriberId: context.subscriberId,
        campaignId: context.campaignId,
        payload: context.payload,
        actionPayload: action.payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned HTTP ${response.status}`);
    }
  }
}
