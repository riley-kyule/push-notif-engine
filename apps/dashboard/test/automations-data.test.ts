import assert from "node:assert/strict";
import test from "node:test";

import { getAutomationSummaries } from "../app/_data/automations";

test("automation summaries respect pagination parameters", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/automations?limit=10&offset=20")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: Array.from({ length: 10 }, (_, index) => ({
                id: `automation-${index + 21}`,
                siteId: "site-1",
                name: `Automation ${index + 21}`,
                triggerEvent: "subscriber_registered",
                status: "active",
                actionCount: 1,
                title: "Title",
                message: "Message",
                url: "https://example.com",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              })),
              total: 37,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await getAutomationSummaries({ limit: 10, offset: 20 });
    assert.equal(result.items.length, 10);
    assert.equal(result.total, 37);
    assert.equal(result.items[0]?.id, "automation-21");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
