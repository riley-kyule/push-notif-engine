import assert from "node:assert/strict";
import test from "node:test";

import { SegmentsController } from "./segments.controller";

test("segments controller returns created segment data", async () => {
  const calls: string[] = [];
  const service = {
    async createSegment() {
      calls.push("create");
      return { id: "segment-1" };
    },
    async listSegments() {
      calls.push("list");
      return { items: [], total: 0 };
    },
    async getSegment() {
      calls.push("get");
      return { id: "segment-1" };
    },
    async updateSegment() {
      calls.push("update");
      return { id: "segment-1" };
    },
    async deleteSegment() {
      calls.push("delete");
    },
    async estimateSegmentReach() {
      calls.push("estimate");
      return { siteId: "site-1", estimatedReach: 1 };
    },
    async estimateSavedSegmentReach() {
      calls.push("estimate-saved");
      return { segmentId: "segment-1", siteId: "site-1", estimatedReach: 1 };
    },
  };

  const controller = new SegmentsController(service as never);
  const user = { id: "user-1" } as never;

  const created = await controller.createSegment(
    {
      siteId: "site-1",
      name: "Segment",
      definition: {
        rules: [{ field: "country", operator: "is", value: "US" }],
      } as never,
    },
    user,
  );

  assert.equal(created.success, true);
  assert.deepEqual(calls, ["create"]);
});
