import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import crypto from "node:crypto";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { isDropboxConfigured, isGoogleDriveConfigured } from "./backup.config";
import { BackupRepository, type BackupProvider } from "./backup.repository";
import { BackupRunnerService } from "./backup-runner.service";
import { DropboxBackupProvider } from "./providers/dropbox.provider";
import { GoogleDriveBackupProvider } from "./providers/google-drive.provider";
import { ExchangeBackupCodeDto } from "./dto/exchange-backup-code.dto";
import { UpdateBackupScheduleDto } from "./dto/update-backup-schedule.dto";

function parseProvider(value: string): BackupProvider {
  if (value === "dropbox" || value === "google_drive") {
    return value;
  }

  throw new BadRequestException("Unknown backup provider — expected 'dropbox' or 'google_drive'");
}

@Controller("backup")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin")
export class BackupController {
  constructor(
    private readonly repository: BackupRepository,
    private readonly runner: BackupRunnerService,
    private readonly dropboxProvider: DropboxBackupProvider,
    private readonly googleDriveProvider: GoogleDriveBackupProvider,
  ) {}

  @Get("providers")
  async listProviders(): Promise<{ success: true; data: unknown }> {
    const connections = await this.repository.listConnections();
    const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));

    const providers: BackupProvider[] = ["dropbox", "google_drive"];
    const data = providers.map((provider) => {
      const connection = byProvider.get(provider);
      return {
        provider,
        configured: provider === "dropbox" ? isDropboxConfigured() : isGoogleDriveConfigured(),
        connected: Boolean(connection),
        accountLabel: connection?.accountLabel ?? null,
        autoBackupEnabled: connection?.autoBackupEnabled ?? false,
        frequency: connection?.frequency ?? "daily",
        nextBackupDueAt: connection?.nextBackupDueAt ?? null,
      };
    });

    return { success: true, data };
  }

  @Get(":provider/authorize-url")
  async getAuthorizeUrl(@Param("provider") providerParam: string): Promise<{ success: true; data: { authorizeUrl: string; state: string } }> {
    const provider = parseProvider(providerParam);
    const client = provider === "dropbox" ? this.dropboxProvider : this.googleDriveProvider;
    const state = crypto.randomBytes(24).toString("hex");

    return { success: true, data: { authorizeUrl: client.buildAuthorizeUrl(state), state } };
  }

  @Post(":provider/exchange")
  async exchangeCode(
    @Param("provider") providerParam: string,
    @Body() dto: ExchangeBackupCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const provider = parseProvider(providerParam);
    const result = await this.runner.connectProvider(provider, dto.code, user.id);
    return { success: true, data: result };
  }

  @Patch(":provider/schedule")
  async updateSchedule(
    @Param("provider") providerParam: string,
    @Body() dto: UpdateBackupScheduleDto,
  ): Promise<{ success: true; data: unknown }> {
    const provider = parseProvider(providerParam);
    const connection = await this.repository.updateAutoBackupSettings(provider, dto);
    if (!connection) {
      throw new BadRequestException(`${provider} is not connected`);
    }

    return { success: true, data: connection };
  }

  @Post(":provider/run")
  async runNow(@Param("provider") providerParam: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    const provider = parseProvider(providerParam);
    const run = await this.runner.triggerManualBackup(provider, user.id);
    return { success: true, data: run };
  }

  @Get("runs")
  async listRuns(): Promise<{ success: true; data: unknown }> {
    const runs = await this.repository.listRuns(25);
    return { success: true, data: runs };
  }

  @Delete(":provider")
  @Roles("super-admin")
  async disconnect(@Param("provider") providerParam: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: { disconnected: true } }> {
    const provider = parseProvider(providerParam);
    await this.runner.disconnectProvider(provider, user.id);
    return { success: true, data: { disconnected: true } };
  }
}
