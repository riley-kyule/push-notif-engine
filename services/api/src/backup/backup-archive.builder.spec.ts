import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";
import * as tar from "tar";
import path from "node:path";
import os from "node:os";

import { BackupArchiveBuilder } from "./backup-archive.builder";
import type { CampaignMediaStoragePort } from "../campaign-media/campaign-media-storage.port";

function createFakeMediaStorage(files: Record<string, string>): CampaignMediaStoragePort {
  return {
    async upload() {
      return undefined;
    },
    async openReadStream(key: string) {
      const content = files[key];
      return content ? Readable.from([Buffer.from(content)]) : null;
    },
    async copy() {
      return undefined;
    },
    async delete() {
      return undefined;
    },
    async exists(key: string) {
      return key in files;
    },
    async ping() {
      return true;
    },
    async listAllKeys() {
      return Object.keys(files);
    },
  };
}

test("BackupArchiveBuilder produces a tar.gz with a real pg_dump and bundled media files", async (t) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    t.skip("DATABASE_URL not set — skipping integration test that requires a real Postgres instance");
    return;
  }

  const storage = createFakeMediaStorage({
    "campaigns/site-1/icon.png": "fake-icon-bytes",
    "campaigns/site-1/image.png": "fake-image-bytes",
  });

  const builder = new BackupArchiveBuilder(storage);
  const result = await builder.build(databaseUrl);

  try {
    assert.ok(result.sizeBytes > 0);
    assert.equal(result.mediaFileCount, 2);
    assert.match(result.fileName, /^epe-backup-.*\.tar\.gz$/);

    const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), "epe-backup-extract-"));
    try {
      await tar.extract({ file: result.filePath, cwd: extractDir });

      const manifest = JSON.parse(await fs.readFile(path.join(extractDir, "manifest.json"), "utf8"));
      assert.equal(manifest.mediaFileCount, 2);

      const dumpStats = await fs.stat(path.join(extractDir, "database.dump"));
      assert.ok(dumpStats.size > 0);

      const iconContent = await fs.readFile(path.join(extractDir, "media", "campaigns", "site-1", "icon.png"), "utf8");
      assert.equal(iconContent, "fake-icon-bytes");
    } finally {
      await fs.rm(extractDir, { recursive: true, force: true });
    }
  } finally {
    await builder.cleanup(result.filePath);
  }
});
