import { Body, ConflictException, Controller, Get, Headers, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import type IORedis from "ioredis";

import { AnalyticsService } from "../analytics/analytics.service";
import { RATE_LIMIT_REDIS } from "../rate-limit/rate-limit.constants";
import { CurrentSite } from "../sites/decorators/current-site.decorator";
import { RestApiAuthGuard } from "../sites/guards/rest-api-auth.guard";
import type { SiteRecord } from "../sites/sites.types";
import { CampaignsService } from "./campaigns.service";
import { SendRestApiNotificationDto } from "./dto/send-rest-api-notification.dto";
import { RestApiSendRateLimitGuard } from "./rest-api-send-rate-limit.guard";
import { NotificationCallbackService } from "./notification-callback.service";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

interface SendNotificationResult {
  notificationId: string;
  jobId: string | undefined;
  queued: true;
}

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
    @Inject(RATE_LIMIT_REDIS) private readonly redis: IORedis,
    private readonly notificationCallbackService: NotificationCallbackService,
  ) {}

  @Post("notifications")
  @UseGuards(RestApiSendRateLimitGuard)
  async sendNotification(
    @CurrentSite() site: SiteRecord,
    @Body() dto: SendRestApiNotificationDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ): Promise<{ success: true; data: SendNotificationResult }> {
    if (!idempotencyKey) {
      return { success: true, data: await this.createAndSend(site, dto) };
    }

    // Reserve the key before doing any work, not after, so two requests
    // racing on the same key (a real client retry sent twice in flight,
    // not just sequentially) can't both pass the check and both send.
    const redisKey = `idempotency:rest-api-notifications:${site.id}:${idempotencyKey}`;
    const reserved = await this.redis.set(redisKey, "PENDING", "EX", IDEMPOTENCY_TTL_SECONDS, "NX");

    if (reserved !== "OK") {
      const existing = await this.redis.get(redisKey);
      if (existing === "PENDING" || existing === null) {
        throw new ConflictException("A request with this idempotency key is already in progress");
      }

      return { success: true, data: JSON.parse(existing) as SendNotificationResult };
    }

    try {
      const result = await this.createAndSend(site, dto);
      await this.redis.set(redisKey, JSON.stringify(result), "EX", IDEMPOTENCY_TTL_SECONDS);
      return { success: true, data: result };
    } catch (error) {
      // Don't let a failed send permanently squat on the idempotency key --
      // a retry after a genuine failure should be allowed to try again.
      await this.redis.del(redisKey);
      throw error;
    }
  }

  private async createAndSend(site: SiteRecord, dto: SendRestApiNotificationDto): Promise<SendNotificationResult> {
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

    if (dto.callbackUrl) {
      await this.notificationCallbackService.register(site.id, campaign.id, dto.callbackUrl);
    }

    const result = await this.campaignsService.sendCampaign(campaign.id);

    return { notificationId: campaign.id, jobId: result.jobId, queued: result.queued };
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

  @Get("notifications/:notificationId/callback")
  async getNotificationCallbackStatus(
    @CurrentSite() site: SiteRecord,
    @Param("notificationId") notificationId: string,
  ): Promise<{ success: true; data: unknown }> {
    const campaign = await this.campaignsService.getCampaign(notificationId);
    if (campaign.siteId !== site.id) throw new NotFoundException("Notification not found");
    return { success: true, data: await this.notificationCallbackService.getStatus(notificationId) };
  }

  @Get("subscribers/count")
  async getSubscriberCount(@CurrentSite() site: SiteRecord): Promise<{ success: true; data: { subscriberCount: number } }> {
    return { success: true, data: { subscriberCount: site.subscriberCount } };
  }
}
