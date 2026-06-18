import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPushService } from "./browser-push.service";
import type { BrowserPushJobPayload } from "./browser-push.types";

test("browser push service enqueues a dispatch job", async () => {
  const fakeSitesService = {
    async getSite() {
      return {
        id: "site-1",
        vapidSubject: "mailto:push@example.com",
        vapidPublicKey: "public-key",
        vapidPrivateKey: "private-key",
      };
    },
  };

  const queue = {
    async add(_name: string, payload: BrowserPushJobPayload) {
      return { id: "job-1", payload };
    },
  };

  const service = new BrowserPushService(fakeSitesService as never, queue as never);

  const result = await service.dispatch({
    siteId: "site-1",
    title: "New article",
    body: "Read the latest update",
    url: "https://example.com/articles/1",
    icon: null,
    image: null,
  });

  assert.equal(result.queued, true);
  assert.equal(result.jobId, "job-1");
});
