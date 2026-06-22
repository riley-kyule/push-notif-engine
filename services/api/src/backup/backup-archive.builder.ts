import { Inject, Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

import { CAMPAIGN_MEDIA_STORAGE } from "../campaign-media/campaign-media.constants";
import type { CampaignMediaStoragePort } from "../campaign-media/campaign-media-storage.port";

export interface BuiltBackupArchive {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  mediaFileCount: number;
}

function runPgDump(databaseUrl: string, outputFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Custom format (-Fc): compressed, supports selective/parallel restore via
    // pg_restore — the right format for "move this to a different server," not just
    // a human-readable SQL dump.
    const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", outputFile, databaseUrl]);

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start pg_dump (is the postgresql-client package installed?): ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

// Builds a single tar.gz containing a full pg_dump (everything in Postgres — sites,
// subscribers, campaigns, segments, automations, audit logs, etc.) plus every object
// in campaign media storage, structured so the archive is enough to stand up EPE on a
// different server. Deliberately excludes .env/secrets — those are deployment
// credentials, not application data, and shouldn't be sitting in a cloud-storage file.
@Injectable()
export class BackupArchiveBuilder {
  constructor(@Inject(CAMPAIGN_MEDIA_STORAGE) private readonly campaignMediaStorage: CampaignMediaStoragePort) {}

  async build(databaseUrl: string): Promise<BuiltBackupArchive> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "epe-backup-"));

    try {
      await runPgDump(databaseUrl, path.join(workDir, "database.dump"));

      const mediaKeys = await this.campaignMediaStorage.listAllKeys();
      const mediaDir = path.join(workDir, "media");
      await fs.mkdir(mediaDir, { recursive: true });

      for (const key of mediaKeys) {
        const destination = path.join(mediaDir, key);
        await fs.mkdir(path.dirname(destination), { recursive: true });

        const stream = await this.campaignMediaStorage.openReadStream(key);
        if (!stream) {
          continue;
        }

        await new Promise<void>((resolve, reject) => {
          const writeStream = createWriteStream(destination);
          stream.pipe(writeStream);
          stream.on("error", reject);
          writeStream.on("error", reject);
          writeStream.on("finish", resolve);
        });
      }

      const manifest = {
        createdAt: new Date().toISOString(),
        mediaFileCount: mediaKeys.length,
        contents: ["database.dump (pg_dump --format=custom — restore with pg_restore)", "media/ (campaign media storage objects, preserving their original keys)"],
        excludes: [".env files and other deployment secrets — recreate these manually on the target server"],
      };
      await fs.writeFile(path.join(workDir, "manifest.json"), JSON.stringify(manifest, null, 2));

      const fileName = `epe-backup-${timestamp}.tar.gz`;
      const archivePath = path.join(os.tmpdir(), fileName);

      await tar.create(
        {
          gzip: true,
          file: archivePath,
          cwd: workDir,
        },
        ["database.dump", "media", "manifest.json"],
      );

      const stats = await fs.stat(archivePath);

      return {
        filePath: archivePath,
        fileName,
        sizeBytes: stats.size,
        mediaFileCount: mediaKeys.length,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  async cleanup(archivePath: string): Promise<void> {
    await fs.rm(archivePath, { force: true });
  }
}
