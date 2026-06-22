import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import fs from "node:fs/promises";

import { AuditService } from "../audit/audit.service";
import { loadDatabaseConfig } from "../database/database.config";
import { BackupArchiveBuilder } from "./backup-archive.builder";
import { BackupRepository, type BackupProvider, type BackupRunRecord, type BackupRunTrigger } from "./backup.repository";
import type { BackupStorageProvider } from "./backup-provider.types";
import { decryptToken, encryptToken } from "./token-encryption.util";
import { DropboxBackupProvider } from "./providers/dropbox.provider";
import { GoogleDriveBackupProvider } from "./providers/google-drive.provider";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

@Injectable()
export class BackupRunnerService {
  private readonly logger = new Logger(BackupRunnerService.name);

  constructor(
    private readonly repository: BackupRepository,
    private readonly archiveBuilder: BackupArchiveBuilder,
    private readonly auditService: AuditService,
    @Inject(DropboxBackupProvider) private readonly dropboxProvider: BackupStorageProvider,
    @Inject(GoogleDriveBackupProvider) private readonly googleDriveProvider: BackupStorageProvider,
  ) {}

  private resolveProviderClient(provider: BackupProvider): BackupStorageProvider {
    return provider === "dropbox" ? this.dropboxProvider : this.googleDriveProvider;
  }

  private async getValidAccessToken(provider: BackupProvider): Promise<string> {
    const connection = await this.repository.findConnection(provider);
    if (!connection) {
      throw new NotFoundException(`${provider} is not connected`);
    }

    const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
    if (connection.accessToken && expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS > Date.now()) {
      return connection.accessToken;
    }

    const refreshToken = decryptToken(connection.encryptedRefreshToken);
    const client = this.resolveProviderClient(provider);
    const refreshed = await client.refreshAccessToken(refreshToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expiresInSeconds * 1000);
    await this.repository.updateAccessToken(provider, refreshed.accessToken, newExpiresAt);

    return refreshed.accessToken;
  }

  // Used by the scheduler, which isn't subject to an HTTP request timeout — runs the
  // whole dump+upload to completion and returns the final record.
  async runBackup(provider: BackupProvider, trigger: BackupRunTrigger, actorUserId?: string): Promise<BackupRunRecord> {
    const connection = await this.repository.findConnection(provider);
    if (!connection) {
      throw new BadRequestException(`${provider} is not connected — connect it first`);
    }

    const runId = await this.repository.createRun(provider, trigger);
    await this.executeBackup(runId, provider, trigger, actorUserId);

    const run = await this.repository.findRunById(runId);
    if (!run) {
      throw new Error("Backup run record disappeared after completion — this should not happen");
    }

    return run;
  }

  // Used by the "Run backup now" HTTP endpoint: a full system backup (DB dump + every
  // media file) can easily take longer than nginx's default proxy timeout (60s), so
  // this creates the run record synchronously (fast — lets us fail fast if the
  // provider isn't connected) and returns immediately while the actual dump+upload
  // continues in the background. The dashboard polls /backup/runs for completion.
  async triggerManualBackup(provider: BackupProvider, actorUserId?: string): Promise<BackupRunRecord> {
    const connection = await this.repository.findConnection(provider);
    if (!connection) {
      throw new BadRequestException(`${provider} is not connected — connect it first`);
    }

    const runId = await this.repository.createRun(provider, "manual");

    void this.executeBackup(runId, provider, "manual", actorUserId).catch((error) => {
      this.logger.error(`Unhandled error from background backup run ${runId}`, error as Error);
    });

    const run = await this.repository.findRunById(runId);
    if (!run) {
      throw new Error("Backup run record disappeared immediately after creation — this should not happen");
    }

    return run;
  }

  private async executeBackup(
    runId: string,
    provider: BackupProvider,
    trigger: BackupRunTrigger,
    actorUserId?: string,
  ): Promise<void> {
    const databaseConfig = loadDatabaseConfig();
    let archivePath: string | null = null;

    try {
      const archive = await this.archiveBuilder.build(databaseConfig.databaseUrl);
      archivePath = archive.filePath;

      const accessToken = await this.getValidAccessToken(provider);
      const fileBuffer = await fs.readFile(archive.filePath);
      const client = this.resolveProviderClient(provider);
      await client.upload(accessToken, archive.fileName, fileBuffer);

      await this.repository.markRunCompleted(runId, { fileName: archive.fileName, sizeBytes: archive.sizeBytes });

      if (trigger === "scheduled") {
        await this.repository.advanceNextBackupDueAt(provider);
      }

      await this.auditService.log({
        actorUserId: actorUserId ?? null,
        action: "backup.completed",
        targetType: "backup_run",
        targetId: runId,
        metadata: { provider, trigger, fileName: archive.fileName, sizeBytes: archive.sizeBytes },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown backup failure";
      this.logger.error(`Backup run ${runId} (${provider}) failed`, error as Error);
      await this.repository.markRunFailed(runId, message);

      await this.auditService.log({
        actorUserId: actorUserId ?? null,
        action: "backup.failed",
        targetType: "backup_run",
        targetId: runId,
        metadata: { provider, trigger, errorMessage: message },
      });

      throw error;
    } finally {
      if (archivePath) {
        await this.archiveBuilder.cleanup(archivePath);
      }
    }
  }

  async connectProvider(
    provider: BackupProvider,
    code: string,
    actorUserId?: string,
  ): Promise<{ provider: BackupProvider; accountLabel: string | null }> {
    const client = this.resolveProviderClient(provider);
    const result = await client.exchangeCode(code);

    const connection = await this.repository.upsertConnection({
      provider,
      encryptedRefreshToken: encryptToken(result.refreshToken),
      accessToken: result.accessToken,
      accessTokenExpiresAt: new Date(Date.now() + result.expiresInSeconds * 1000),
      accountLabel: result.accountLabel,
    });

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "backup.provider_connected",
      targetType: "backup_connection",
      targetId: connection.id,
      metadata: { provider, accountLabel: result.accountLabel },
    });

    return { provider, accountLabel: connection.accountLabel };
  }

  async disconnectProvider(provider: BackupProvider, actorUserId?: string): Promise<void> {
    const deleted = await this.repository.deleteConnection(provider);
    if (!deleted) {
      throw new NotFoundException(`${provider} is not connected`);
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "backup.provider_disconnected",
      targetType: "backup_connection",
      targetId: provider,
      metadata: { provider },
    });
  }
}
