import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { CampaignMediaModule } from "../campaign-media/campaign-media.module";
import { DatabaseModule } from "../database/database.module";
import { BackupArchiveBuilder } from "./backup-archive.builder";
import { BackupController } from "./backup.controller";
import { BackupRepository } from "./backup.repository";
import { BackupRunnerService } from "./backup-runner.service";
import { BackupSchedulerService } from "./backup-scheduler.service";
import { DropboxBackupProvider } from "./providers/dropbox.provider";
import { GoogleDriveBackupProvider } from "./providers/google-drive.provider";

@Module({
  imports: [DatabaseModule, AuditModule, CampaignMediaModule],
  controllers: [BackupController],
  providers: [
    BackupRepository,
    BackupArchiveBuilder,
    BackupRunnerService,
    BackupSchedulerService,
    DropboxBackupProvider,
    GoogleDriveBackupProvider,
  ],
  exports: [BackupRunnerService],
})
export class BackupModule {}
