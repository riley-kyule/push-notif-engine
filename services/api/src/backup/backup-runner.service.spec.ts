import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { BackupRunnerService } from "./backup-runner.service";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitForStatus(
  runs: Map<string, { status: string }>,
  id: string,
  expected: string,
  timeoutMs = 500,
): Promise<void> {
  const startedAt = Date.now();
  while ((runs.get(id)?.status ?? "") !== expected) {
    if (Date.now() - startedAt > timeoutMs) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("triggerManualBackup returns immediately while the backup runs in the background", async () => {
  process.env.BACKUP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/db";

  const runs = new Map<string, { status: string }>();
  const uploadGate = createDeferred<void>();

  const repository = {
    async findConnection() {
      return { provider: "dropbox", encryptedRefreshToken: "x", accessToken: "tok", accessTokenExpiresAt: new Date(Date.now() + 600_000) };
    },
    async createRun() {
      const id = "run-1";
      runs.set(id, { status: "running" });
      return id;
    },
    async findRunById(id: string) {
      const run = runs.get(id);
      return run ? { id, ...run } : null;
    },
    async markRunCompleted(id: string) {
      runs.set(id, { status: "completed" });
    },
    async markRunFailed(id: string) {
      runs.set(id, { status: "failed" });
    },
    async updateAccessToken() {
      return undefined;
    },
    async advanceNextBackupDueAt() {
      return undefined;
    },
  };

  const fakeArchivePath = path.join(os.tmpdir(), `epe-backup-test-${crypto.randomUUID()}.tar.gz`);
  await fs.writeFile(fakeArchivePath, "fake archive contents");

  const archiveBuilder = {
    async build() {
      await uploadGate.promise;
      return { filePath: fakeArchivePath, fileName: "fake.tar.gz", sizeBytes: 123, mediaFileCount: 0 };
    },
    async cleanup(filePath: string) {
      await fs.rm(filePath, { force: true });
    },
  };

  const auditService = { async log() {} };
  const dropboxProvider = { async upload() { return { providerFileId: "id-1" }; } };
  const googleDriveProvider = { async upload() { return { providerFileId: null }; } };

  const service = new BackupRunnerService(
    repository as never,
    archiveBuilder as never,
    auditService as never,
    dropboxProvider as never,
    googleDriveProvider as never,
  );

  const result = await service.triggerManualBackup("dropbox", "user-1");

  assert.equal(result.status, "running");
  assert.equal(runs.get("run-1")?.status, "running");

  uploadGate.resolve();
  await waitForStatus(runs, "run-1", "completed");

  assert.equal(runs.get("run-1")?.status, "completed");
});
