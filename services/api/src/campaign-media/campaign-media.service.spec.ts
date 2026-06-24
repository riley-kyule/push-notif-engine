import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { InMemoryCampaignMediaRepository } from "./in-memory-campaign-media.repository";
import { CampaignMediaService } from "./campaign-media.service";
import type { CampaignMediaStoragePort } from "./campaign-media-storage.port";
import type { CampaignMediaUploadFile } from "./campaign-media-file.type";

// getApiBaseUrl() now requires this (see campaign-media.service.ts) rather
// than silently falling back to a broken 127.0.0.1 default.
process.env.PUBLIC_API_BASE_URL ??= "https://api.example.com/api";

function createStorage(): CampaignMediaStoragePort & { entries: Map<string, Buffer> } {
  const entries = new Map<string, Buffer>();
  return {
    entries,
    async upload(input) {
      entries.set(input.key, Buffer.from(input.body));
    },
    async openReadStream(key) {
      const body = entries.get(key);
      return body ? Readable.from([body]) : null;
    },
    async copy(input) {
      const body = entries.get(input.sourceKey);
      if (!body) {
        throw new Error("missing source");
      }
      entries.set(input.destinationKey, Buffer.from(body));
    },
    async delete(key) {
      entries.delete(key);
    },
    async exists(key) {
      return entries.has(key);
    },
    async ping() {
      return true;
    },
    async listAllKeys() {
      return Array.from(entries.keys());
    },
  };
}

test("campaign media service uploads image assets to object storage", async () => {
  const repository = new InMemoryCampaignMediaRepository();
  const storage = createStorage();
  const service = new CampaignMediaService(
    {
      async getSite() {
        return { id: "site-1" };
      },
    } as never,
    repository as never,
    storage,
  );

  const result = await service.uploadMedia({
    siteId: "site-1",
    kind: "image",
    file: {
      buffer: Buffer.from("media-bytes"),
      mimetype: "image/png",
      originalname: "hero image.png",
      size: 11,
    } as CampaignMediaUploadFile,
  });

  assert.equal(repository.assets.length, 1);
  assert.equal(result.kind, "image");
  assert.equal(result.publicUrl.includes(result.id), true);
  const asset = repository.assets[0];
  assert.ok(asset);
  assert.equal(storage.entries.get(asset.storagePath)?.toString("utf8"), "media-bytes");
});

test("campaign media service lists gallery assets for a site, newest first, optionally filtered by kind", async () => {
  const repository = new InMemoryCampaignMediaRepository();
  const storage = createStorage();
  const service = new CampaignMediaService(
    {
      async getSite() {
        return { id: "site-1" };
      },
    } as never,
    repository as never,
    storage,
  );

  const older = await repository.create({
    siteId: "site-1",
    campaignId: null,
    kind: "image",
    originalName: "older.png",
    mimeType: "image/png",
    sizeBytes: 11,
    storagePath: "campaign-media/older.png",
    publicUrl: "https://api.example.com/api/campaign-media/older/file",
  });
  repository.assets[0] = { ...older, createdAt: new Date("2026-01-01T00:00:00.000Z") };

  await repository.create({
    siteId: "site-1",
    campaignId: null,
    kind: "icon",
    originalName: "newer-icon.png",
    mimeType: "image/png",
    sizeBytes: 11,
    storagePath: "campaign-media/newer-icon.png",
    publicUrl: "https://api.example.com/api/campaign-media/newer-icon/file",
  });

  await repository.create({
    siteId: "site-2",
    campaignId: null,
    kind: "image",
    originalName: "other-site.png",
    mimeType: "image/png",
    sizeBytes: 11,
    storagePath: "campaign-media/other-site.png",
    publicUrl: "https://api.example.com/api/campaign-media/other-site/file",
  });

  const all = await service.listMediaForSite("site-1");
  assert.equal(all.length, 2);
  assert.equal(all[0]?.originalName, "newer-icon.png");

  const onlyImages = await service.listMediaForSite("site-1", "image");
  assert.equal(onlyImages.length, 1);
  assert.equal(onlyImages[0]?.originalName, "older.png");
});

test("campaign media service cleans up delivered campaign assets after retention", async () => {
  const repository = new InMemoryCampaignMediaRepository();
  const storage = createStorage();
  const service = new CampaignMediaService(
    {
      async getSite() {
        return { id: "site-1" };
      },
    } as never,
    repository as never,
    storage,
  );

  const asset = await repository.create({
    id: "asset-1",
    siteId: "site-1",
    campaignId: "campaign-1",
    kind: "image",
    originalName: "stale.png",
    mimeType: "image/png",
    sizeBytes: 11,
    storagePath: "campaign-media/asset-1.png",
    publicUrl: "http://127.0.0.1:3001/api/campaign-media/asset-1/file",
  });
  repository.assets[0] = { ...asset, createdAt: new Date("2026-01-01T00:00:00.000Z") };
  storage.entries.set("campaign-media/asset-1.png", Buffer.from("stale-bytes"));

  const deleted = await service.cleanupExpiredCampaignAssets(new Date("2026-01-05T00:00:00.000Z"));

  assert.equal(deleted, 1);
  assert.equal(repository.assets.length, 0);
  assert.equal(storage.entries.has("campaign-media/asset-1.png"), false);
});

test("campaign media service streams uploaded media files", async () => {
  const repository = new InMemoryCampaignMediaRepository();
  const storage = createStorage();
  const service = new CampaignMediaService(
    {
      async getSite() {
        return { id: "site-1" };
      },
    } as never,
    repository as never,
    storage,
  );

  const asset = await repository.create({
    id: "asset-2",
    siteId: "site-1",
    campaignId: null,
    kind: "icon",
    originalName: "icon.png",
    mimeType: "image/png",
    sizeBytes: 8,
    storagePath: "campaign-media/asset-2.png",
    publicUrl: "http://127.0.0.1:3001/api/campaign-media/asset-2/file",
  });
  storage.entries.set("campaign-media/asset-2.png", Buffer.from("icon-bytes"));
  repository.assets[0] = asset;

  const { asset: found, stream } = await service.openMediaFile("asset-2");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Buffer));
  }

  assert.equal(found.id, "asset-2");
  assert.equal(Buffer.concat(chunks).toString("utf8"), "icon-bytes");
});
