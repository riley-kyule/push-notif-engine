import assert from "node:assert/strict";
import test from "node:test";

import { CampaignMediaController } from "./campaign-media.controller";

test("campaign media controller uploads assets through the service", async () => {
  const calls: Array<string> = [];
  const service = {
    async uploadMedia() {
      calls.push("upload");
      return { id: "asset-1", publicUrl: "http://127.0.0.1:3001/api/campaign-media/asset-1/file", kind: "image" as const };
    },
    async getMediaFile() {
      calls.push("get");
      return null;
    },
  };

  const controller = new CampaignMediaController(service as never);
  const response = await controller.uploadMedia(
    { siteId: "site-1", kind: "image" } as never,
    {
      buffer: Buffer.from("image-bytes"),
      mimetype: "image/png",
      originalname: "hero.png",
      size: 11,
    } as never,
  );

  assert.equal(response.success, true);
  assert.deepEqual(calls, ["upload"]);
});
