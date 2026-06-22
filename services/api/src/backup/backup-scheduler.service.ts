import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { BackupRepository } from "./backup.repository";
import { BackupRunnerService } from "./backup-runner.service";

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private running = false;

  constructor(
    private readonly repository: BackupRepository,
    private readonly runner: BackupRunnerService,
  ) {}

  // Hourly is granular enough for daily/weekly/monthly schedules — a backup is "due"
  // when next_backup_due_at has passed, so the worst-case drift is under an hour.
  @Cron(CronExpression.EVERY_HOUR)
  async runDueBackups(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const due = await this.repository.findDueConnections(new Date());

      for (const connection of due) {
        try {
          await this.runner.runBackup(connection.provider, "scheduled");
        } catch (error) {
          this.logger.error(`Scheduled backup failed for ${connection.provider}`, error as Error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
