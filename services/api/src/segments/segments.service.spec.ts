import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySegmentsRepository } from "./in-memory-segments.repository";
import { SegmentsService } from "./segments.service";

test("segments service creates, updates, and estimates reach", async () => {
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
  };

  const subscribersRepository = {
    async list() {
      return {
        items: [
          {
            id: "subscriber-1",
            siteId: "site-1",
            browser: "Chrome",
            deviceType: "Mobile",
            country: "ZA",
            language: "en",
            subscriptionEndpoint: "https://example.com/1",
            p256dhKey: null,
            authKey: null,
            status: "active",
            lastSeenAt: new Date("2026-06-10T00:00:00.000Z"),
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            updatedAt: new Date("2026-06-10T00:00:00.000Z"),
          },
          {
            id: "subscriber-2",
            siteId: "site-1",
            browser: "Firefox",
            deviceType: "Desktop",
            country: "US",
            language: "en",
            subscriptionEndpoint: "https://example.com/2",
            p256dhKey: null,
            authKey: null,
            status: "active",
            lastSeenAt: new Date("2026-05-01T00:00:00.000Z"),
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z"),
          },
        ],
        total: 2,
      };
    },
  };

  const repository = new InMemorySegmentsRepository(subscribersRepository as never);
  const service = new SegmentsService(sitesService as never, repository as never);

  const created = await service.createSegment({
    siteId: "site-1",
    name: "Mobile South Africa",
    definition: {
      matchMode: "all",
      rules: [
        { field: "country", operator: "is", value: "ZA" },
        { field: "deviceType", operator: "is", value: "Mobile" },
      ],
    },
  });

  assert.equal(created.name, "Mobile South Africa");
  assert.equal(created.definition.rules.length, 2);

  const updated = await service.updateSegment(created.id, {
    status: "archived",
  });

  assert.equal(updated.status, "archived");

  const estimate = await service.estimateSavedSegmentReach(created.id);
  assert.equal(estimate.segmentId, created.id);
  assert.equal(estimate.estimatedReach, 1);

  const adHocEstimate = await service.estimateSegmentReach({
    siteId: "site-1",
    definition: {
      matchMode: "any",
      rules: [
        { field: "country", operator: "is", value: "US" },
        { field: "deviceType", operator: "is", value: "Mobile" },
      ],
    },
  });

  assert.equal(adHocEstimate.estimatedReach, 2);
});
