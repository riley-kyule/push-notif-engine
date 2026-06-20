import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowController } from "./workflow.controller";

test("workflow controller records events", async () => {
  const calls: unknown[] = [];
  const controller = new WorkflowController({
    async recordEvent(input: unknown) {
      calls.push(input);
      return { id: "event-1" };
    },
    async listRssFeeds() {
      return { items: [], total: 0 };
    },
    async createRssFeed() {
      return { id: "feed-1" };
    },
    async getRssFeed() {
      return { id: "feed-1" };
    },
    async updateRssFeed() {
      return { id: "feed-1" };
    },
    async deleteRssFeed() {},
    async pollFeed() {},
  } as never);

  const result = await controller.recordEvent({
    siteId: "site-1",
    triggerEvent: "api_event",
    payload: { key: "value" },
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls[0], {
    siteId: "site-1",
    subscriberId: null,
    campaignId: null,
    triggerEvent: "api_event",
    payload: { key: "value" },
  });
});

test("workflow controller creates RSS feeds", async () => {
  const calls: unknown[] = [];
  const controller = new WorkflowController({
    async recordEvent() {
      return { id: "event-1" };
    },
    async listRssFeeds() {
      return { items: [], total: 0 };
    },
    async createRssFeed(input: unknown) {
      calls.push(input);
      return { id: "feed-1" };
    },
    async getRssFeed() {
      return { id: "feed-1" };
    },
    async updateRssFeed() {
      return { id: "feed-1" };
    },
    async deleteRssFeed() {},
    async pollFeed() {},
  } as never);

  const result = await controller.createFeed({
    siteId: "site-1",
    name: "News",
    feedUrl: "https://example.com/feed.xml",
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls[0], {
    siteId: "site-1",
    name: "News",
    feedUrl: "https://example.com/feed.xml",
    status: "active",
  });
});
