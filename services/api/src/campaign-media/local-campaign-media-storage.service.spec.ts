import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalCampaignMediaStorageService } from "./local-campaign-media-storage.service";

test("local campaign media storage writes, reads, copies, and lists keys", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "epe-media-"));
  const previousRoot = process.env.CAMPAIGN_MEDIA_STORAGE_ROOT;
  process.env.CAMPAIGN_MEDIA_STORAGE_ROOT = root;

  try {
    const storage = new LocalCampaignMediaStorageService();

    await storage.upload({
      key: "campaign-media/example.png",
      body: Buffer.from("hello"),
      contentType: "image/png",
    });

    assert.equal(await storage.exists("campaign-media/example.png"), true);

    const stream = await storage.openReadStream("campaign-media/example.png");
    assert.ok(stream);
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    assert.equal(Buffer.concat(chunks).toString("utf8"), "hello");

    await storage.copy({
      sourceKey: "campaign-media/example.png",
      destinationKey: "campaign-media/copied.png",
      contentType: "image/png",
    });

    assert.equal(await storage.exists("campaign-media/copied.png"), true);
    assert.deepEqual(await storage.listAllKeys(), ["campaign-media/copied.png", "campaign-media/example.png"]);

    await storage.delete("campaign-media/example.png");
    await storage.delete("campaign-media/copied.png");
    assert.equal(await storage.exists("campaign-media/example.png"), false);
    assert.equal(await storage.exists("campaign-media/copied.png"), false);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.CAMPAIGN_MEDIA_STORAGE_ROOT;
    } else {
      process.env.CAMPAIGN_MEDIA_STORAGE_ROOT = previousRoot;
    }
    await rm(root, { recursive: true, force: true });
  }
});
