import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { CampaignMediaService } from "./campaign-media.service";

@Injectable()
export class CampaignMediaSchedulerService {
  private readonly logger = new Logger(CampaignMediaSchedulerService.name);
  private running = false;

  constructor(private readonly campaignMediaService: CampaignMediaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredMedia(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const deleted = await this.campaignMediaService.cleanupExpiredCampaignAssets(new Date());
      if (deleted > 0) {
        this.logger.log(`Purged ${deleted} campaign media assets`);
      }
    } finally {
      this.running = false;
    }
  }
}
