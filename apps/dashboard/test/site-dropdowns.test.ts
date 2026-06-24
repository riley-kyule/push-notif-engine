import assert from "node:assert/strict";
import test from "node:test";

import { fallbackSiteChoices, getSiteChoices } from "../app/_data/sites";

test("site dropdown data loads the full site list and keeps All Sites available", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const template = fallbackSiteChoices[0]!;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/sites?limit=500&offset=0")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: Array.from({ length: 25 }, (_, index) => ({
                ...template,
                id: `site-a-${index + 1}`,
                name: `Site ${index + 1}`,
                url: `https://site-${index + 1}.example.com`,
                appName: `Site ${index + 1}`,
              })),
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ success: false }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const sites = await getSiteChoices();
    assert.equal(sites.length, 26);
    assert.equal(sites[0]?.id, "site-a-1");
    assert.equal(sites.at(-1)?.id, "site-3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
