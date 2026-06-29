import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";

import { AnalyticsService } from "../analytics/analytics.service";
import { CurrentSite } from "../sites/decorators/current-site.decorator";
import { RestApiAuthGuard } from "../sites/guards/rest-api-auth.guard";
import type { SiteRecord } from "../sites/sites.types";
import { CampaignsService } from "./campaigns.service";
import { SendRestApiNotificationDto } from "./dto/send-rest-api-notification.dto";

// CRM-facing counterpart to CampaignsController -- same underlying
// create-then-send flow, but authenticated via a site's REST API key/token
// pair (RestApiAuthGuard) instead of a dashboard JWT, and collapsed into a
// single call since an external caller has no use for the draft/segment/
// schedule workflow the dashboard UI walks an admin through.
@Controller("sites/:siteId/rest-api")
@UseGuards(RestApiAuthGuard)
export class RestApiCampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Post("notifications")
  async sendNotification(
    @CurrentSite() site: SiteRecord,
    @Body() dto: SendRestApiNotificationDto,
  ): Promise<{ success: true; data: { notificationId: string; jobId: string | undefined; queued: true } }> {
    const campaign = await this.campaignsService.createCampaign({
      siteId: site.id,
      name: dto.title,
      channel: "web",
      type: "instant",
      title: dto.title,
      message: dto.body,
      url: dto.url,
      ...(dto.icon !== undefined ? { iconUrl: dto.icon } : {}),
      ...(dto.image !== undefined ? { imageUrl: dto.image } : {}),
    });

    const result = await this.campaignsService.sendCampaign(campaign.id);

    return {
      success: true,
      data: { notificationId: campaign.id, jobId: result.jobId, queued: result.queued },
    };
  }

  @Get("notifications/:notificationId/status")
  async getNotificationStatus(
    @CurrentSite() site: SiteRecord,
    @Param("notificationId") notificationId: string,
  ): Promise<{
    success: true;
    data: {
      notificationId: string;
      status: string;
      pending: number;
      sent: number;
      delivered: number;
      failed: number;
      expired: number;
      clicked: number;
      total: number;
      deliveryRate: number;
      clickThroughRate: number;
    };
  }> {
    const campaign = await this.campaignsService.getCampaign(notificationId);
    // A REST API credential is scoped to one site -- without this check, a
    // valid key for site A could read delivery stats for any campaign ID on
    // any site, just by guessing/enumerating UUIDs.
    if (campaign.siteId !== site.id) {
      throw new NotFoundException("Notification not found");
    }

    const stats = await this.analyticsService.getCampaignStats(notificationId);

    return {
      success: true,
      data: { notificationId, status: campaign.status, ...stats },
    };
  }

  @Get("subscribers/count")
  async getSubscriberCount(@CurrentSite() site: SiteRecord): Promise<{ success: true; data: { subscriberCount: number } }> {
    return { success: true, data: { subscriberCount: site.subscriberCount } };
  }
}
