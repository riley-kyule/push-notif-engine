import assert from "node:assert/strict";
import test from "node:test";

import { dispatchBrowserPush } from "../lib/browser-push-dispatch";

test("browser push dispatch proxies queued jobs from the API", async () => {
  const result = await dispatchBrowserPush(
    {
      siteId: "site-1",
      title: "New article",
      body: "Read the latest update",
      url: "https://example.com/articles/1",
      icon: null,
      image: null,
      campaignId: null,
    },
    {
      authorizationToken: "token-123",
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("authorization"), "Bearer token-123");
        return new Response(JSON.stringify({ success: true, data: { jobId: "job-1", queued: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected dispatch to succeed");
  }
  assert.equal(result.jobId, "job-1");
  assert.equal(result.queued, true);
});

test("browser push dispatch reports API failures", async () => {
  const result = await dispatchBrowserPush(
    {
      siteId: "site-1",
      title: "New article",
      body: "Read the latest update",
      url: "https://example.com/articles/1",
      icon: null,
      image: null,
      campaignId: null,
    },
    {
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "Browser push credentials are not configured for this site" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected dispatch failure");
  }
  assert.equal(result.status, 503);
  assert.equal(result.error, "Browser push credentials are not configured for this site");
});
