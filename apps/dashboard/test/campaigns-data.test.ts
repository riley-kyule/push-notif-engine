import assert from "node:assert/strict";
import test from "node:test";

import { getCampaignList } from "../app/_data/campaigns";

const CAMPAIGN_A = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_B = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("campaign list rows hydrate sent/CTR from the bulk analytics endpoint", async (t) => {
  const requests: string[] = [];
  const originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/analytics/campaigns?ids=")) {
      return jsonResponse({
        success: true,
        data: {
          [CAMPAIGN_A]: { sent: 40, delivered: 60, clicked: 25, total: 120, clickThroughRate: 25 },
        },
      });
    }
    if (url.includes("/campaigns?")) {
      return jsonResponse({
        success: true,
        data: {
          items: [
            { id: CAMPAIGN_A, name: "Weekend Sale", type: "instant", status: "sent" },
            { id: CAMPAIGN_B, name: "Unsent Draft", type: "scheduled", status: "draft" },
          ],
          total: 2,
        },
      });
    }
    return jsonResponse({ success: true, data: {} });
  }) as typeof fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  const list = await getCampaignList();

  assert.equal(list.total, 2);
  const [sale, draft] = list.items;
  // sent + delivered from analytics, not the "0" placeholder
  assert.equal(sale?.sent, "100");
  assert.equal(sale?.ctr, "25%");
  // campaigns without delivery events keep the placeholder values
  assert.equal(draft?.sent, "0");
  assert.equal(draft?.ctr, "0%");

  const statsRequest = requests.find((url) => url.includes("/analytics/campaigns?ids="));
  assert.ok(statsRequest, "expected one bulk stats request for the page");
  assert.ok(statsRequest.includes(CAMPAIGN_A));
  assert.ok(statsRequest.includes(CAMPAIGN_B));
});

test("campaign list falls back to placeholder metrics when analytics is unreachable", async (t) => {
  const originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/analytics/campaigns?ids=")) {
      return new Response("unavailable", { status: 503 });
    }
    if (url.includes("/campaigns?")) {
      return jsonResponse({
        success: true,
        data: {
          items: [{ id: CAMPAIGN_A, name: "Weekend Sale", type: "instant", status: "sent" }],
          total: 1,
        },
      });
    }
    return jsonResponse({ success: true, data: {} });
  }) as typeof fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  const list = await getCampaignList();

  assert.equal(list.items[0]?.sent, "0");
  assert.equal(list.items[0]?.ctr, "0%");
});
