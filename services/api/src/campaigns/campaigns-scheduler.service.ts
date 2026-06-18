import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { CampaignsService } from "./campaigns.service";

@Injectable()
export class CampaignsSchedulerService {
  private readonly logger = new Logger(CampaignsSchedulerService.name);
  private running = false;

  constructor(private readonly campaignsService: CampaignsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueCampaigns(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const due = await this.campaignsService.listDueScheduledCampaigns(new Date());

      for (const campaign of due) {
        try {
          if (campaign.recurrenceType) {
            await this.campaignsService.dispatchScheduledOccurrence(campaign);
            await this.campaignsService.advanceRecurringCampaign(campaign);
          } else {
            await this.campaignsService.sendCampaign(campaign.id);
          }
        } catch (error) {
          this.logger.error(`Failed to dispatch scheduled campaign ${campaign.id}`, error as Error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
