import assert from "node:assert/strict";
import test from "node:test";

import { createFakeAuditService } from "../audit/audit.service.fake";
import { InMemoryAutomationsRepository } from "../automations/in-memory-automations.repository";
import { AutomationsService } from "../automations/automations.service";
import { InMemoryWorkflowRepository } from "./in-memory-workflow.repository";
import { WorkflowService } from "./workflow.service";

function createService() {
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
    async getSiteAutomationDefaults() {
      return { id: "site-1", name: "Exotic Travel", url: "https://exotic-travel.example.com" };
    },
  };

  const repository = new InMemoryWorkflowRepository();
  const automationsRepository = new InMemoryAutomationsRepository();
  const automationsService = new AutomationsService(sitesService as never, createFakeAuditService(), automationsRepository as never);
  const dispatchCalls: unknown[] = [];
  const browserPushService = {
    async dispatch(input: unknown) {
      dispatchCalls.push(input);
      return { jobId: "job-1", queued: true as const };
    },
  };

  const workflowService = new WorkflowService(
    sitesService as never,
    automationsService as never,
    browserPushService as never,
    repository as never,
  );

  return { workflowService, repository, automationsService, dispatchCalls };
}

test("workflow service records events and executes notification and tag actions", async () => {
  const { workflowService, repository, automationsService, dispatchCalls } = createService();

  await automationsService.createAutomation({
    siteId: "site-1",
    name: "Welcome workflow",
    triggerEvent: "subscriber_registered",
    title: "Welcome",
    message: "Thanks for joining",
    url: "https://example.com/welcome",
    actions: [
      { type: "add_tag", tag: "new-subscriber" },
      {
        type: "send_notification",
        title: "Welcome",
        message: "Thanks for joining",
        url: "https://example.com/welcome",
      },
    ],
  });

  const event = await workflowService.recordEvent({
    siteId: "site-1",
    subscriberId: "subscriber-1",
    triggerEvent: "subscriber_registered",
    payload: { source: "unit-test" },
  });

  assert.equal(event.status, "completed");
  assert.equal(repository.tags.length, 1);
  assert.equal(dispatchCalls.length, 1);
});

test("an All Sites automation's {{site_name}}/{{site_url}} tokens resolve to the real site a subscriber belongs to", async () => {
  const { workflowService, automationsService, dispatchCalls } = createService();

  const automation = await automationsService.createAutomation({
    siteId: null,
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    title: "Welcome to {{site_name}}!",
    message: "Thanks for subscribing",
    url: "{{site_url}}",
  });

  await workflowService.recordEvent({
    siteId: "site-1",
    subscriberId: "subscriber-1",
    triggerEvent: "subscriber_registered",
    payload: {},
  });

  assert.equal(dispatchCalls.length, 1);
  assert.deepEqual(dispatchCalls[0], {
    siteId: "site-1",
    subscriberId: "subscriber-1",
    title: "Welcome to Exotic Travel!",
    body: "Thanks for subscribing",
    url: "https://exotic-travel.example.com",
    icon: null,
    image: null,
    campaignId: null,
    automationId: automation.id,
  });
});

test("workflow service polls RSS feeds and emits rss_item_published events", async () => {
  const { workflowService, repository, automationsService, dispatchCalls } = createService();

  await automationsService.createAutomation({
    siteId: "site-1",
    name: "RSS workflow",
    triggerEvent: "rss_item_published",
    title: "New article",
    message: "Read the latest update",
    url: "https://example.com/articles/latest",
  });

  const feed = await workflowService.createRssFeed({
    siteId: "site-1",
    name: "News",
    feedUrl: "https://example.com/feed.xml",
    status: "active",
  });

  const originalFetch = globalThis.fetch;
  const globalWithFetch = globalThis as typeof globalThis & { fetch: typeof fetch };
  globalWithFetch.fetch = (async () =>
    new Response(
      `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <guid>item-1</guid>
          <title>Article one</title>
          <link>https://example.com/articles/one</link>
          <pubDate>Fri, 20 Jun 2026 10:00:00 GMT</pubDate>
          <description>First item</description>
        </item>
      </channel></rss>`,
      { status: 200, headers: { "content-type": "application/rss+xml" } },
    )) as never;

  try {
    await workflowService.pollFeed(feed);
  } finally {
    globalWithFetch.fetch = originalFetch;
  }

  assert.equal(repository.events.length, 1);
  assert.equal(dispatchCalls.length, 1);
  assert.equal(repository.feeds[0]?.lastItemGuid, "item-1");
});
