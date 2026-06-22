import assert from "node:assert/strict";
import test from "node:test";

import { BackupController } from "./backup.controller";
import { DropboxBackupProvider } from "./providers/dropbox.provider";
import { GoogleDriveBackupProvider } from "./providers/google-drive.provider";

function createController(overrides: { repository?: object; runner?: object } = {}) {
  const repository = {
    async listConnections() {
      return [];
    },
    async listRuns() {
      return [];
    },
    async updateAutoBackupSettings() {
      return { id: "conn-1" };
    },
    ...overrides.repository,
  };

  const runner = {
    async connectProvider() {
      return { provider: "dropbox", accountLabel: "user@example.com" };
    },
    async triggerManualBackup() {
      return { id: "run-1", status: "running" };
    },
    async disconnectProvider() {
      return undefined;
    },
    ...overrides.runner,
  };

  const dropboxProvider = new DropboxBackupProvider();
  const googleDriveProvider = new GoogleDriveBackupProvider();

  return new BackupController(repository as never, runner as never, dropboxProvider, googleDriveProvider);
}

test("backup controller rejects an unknown provider", async () => {
  const controller = createController();
  await assert.rejects(() => controller.exchangeCode("not-a-provider", { code: "abc" }, { id: "user-1" } as never));
});

test("backup controller lists provider connection status", async () => {
  const controller = createController({
    repository: {
      async listConnections() {
        return [
          {
            provider: "dropbox",
            accountLabel: "user@example.com",
            autoBackupEnabled: true,
            frequency: "daily",
            nextBackupDueAt: null,
          },
        ];
      },
    },
  });

  const result = await controller.listProviders();

  assert.equal(result.success, true);
  const dropboxEntry = (result.data as Array<{ provider: string; connected: boolean }>).find((entry) => entry.provider === "dropbox");
  assert.equal(dropboxEntry?.connected, true);
  const driveEntry = (result.data as Array<{ provider: string; connected: boolean }>).find((entry) => entry.provider === "google_drive");
  assert.equal(driveEntry?.connected, false);
});

test("backup controller exchanges a code for the requested provider", async () => {
  const calls: unknown[] = [];
  const controller = createController({
    runner: {
      async connectProvider(provider: string, code: string, userId: string) {
        calls.push({ provider, code, userId });
        return { provider, accountLabel: "user@example.com" };
      },
    },
  });

  const result = await controller.exchangeCode("dropbox", { code: "auth-code-1" }, { id: "user-1" } as never);

  assert.equal(result.success, true);
  assert.deepEqual(calls, [{ provider: "dropbox", code: "auth-code-1", userId: "user-1" }]);
});

test("backup controller triggers a manual backup for the requested provider", async () => {
  const calls: unknown[] = [];
  const controller = createController({
    runner: {
      async triggerManualBackup(provider: string, userId: string) {
        calls.push({ provider, userId });
        return { id: "run-1", status: "running" };
      },
    },
  });

  const result = await controller.runNow("google_drive", { id: "user-1" } as never);

  assert.deepEqual(calls, [{ provider: "google_drive", userId: "user-1" }]);
  assert.equal((result.data as { status: string }).status, "running");
});
