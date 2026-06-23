import { Injectable } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import type {
  CampaignMediaStorageCopyInput,
  CampaignMediaStoragePort,
  CampaignMediaStorageUploadInput,
} from "./campaign-media-storage.port";

function resolveStorageRoot(): string {
  const configuredRoot = process.env.CAMPAIGN_MEDIA_STORAGE_ROOT ?? "storage/campaign-media";
  return path.resolve(process.cwd(), configuredRoot);
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function collectFiles(root: string, currentDir: string, output: string[]): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(root, absolutePath, output);
      continue;
    }
    if (entry.isFile()) {
      output.push(path.relative(root, absolutePath).split(path.sep).join("/"));
    }
  }
}

@Injectable()
export class LocalCampaignMediaStorageService implements CampaignMediaStoragePort {
  private readonly root = resolveStorageRoot();

  private resolveKeyPath(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw new Error("Invalid campaign media key");
    }
    return resolved;
  }

  async upload(input: CampaignMediaStorageUploadInput): Promise<void> {
    const filePath = this.resolveKeyPath(input.key);
    await ensureParentDirectory(filePath);
    await writeFile(filePath, input.body);
  }

  async openReadStream(key: string): Promise<Readable | null> {
    const filePath = this.resolveKeyPath(key);
    try {
      await stat(filePath);
      return createReadStream(filePath);
    } catch {
      return null;
    }
  }

  async copy(input: CampaignMediaStorageCopyInput): Promise<void> {
    const sourcePath = this.resolveKeyPath(input.sourceKey);
    const destinationPath = this.resolveKeyPath(input.destinationKey);
    await ensureParentDirectory(destinationPath);
    const sourceBody = await readFile(sourcePath);
    await writeFile(destinationPath, sourceBody);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    await rm(filePath, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveKeyPath(key);
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async ping(): Promise<boolean> {
    await mkdir(this.root, { recursive: true });
    return true;
  }

  async listAllKeys(): Promise<string[]> {
    await mkdir(this.root, { recursive: true });
    const output: string[] = [];
    await collectFiles(this.root, this.root, output);
    return output.sort();
  }
}
