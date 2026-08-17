import { BadRequestException, Body, ConflictException, Controller, Get, Headers, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import type IORedis from "ioredis";
import { createHash } from "node:crypto";

import { AnalyticsService } from "../analytics/analytics.service";
import { RATE_LIMIT_REDIS } from "../rate-limit/rate-limit.constants";
import { CurrentSite } from "../sites/decorators/current-site.decorator";
import { RestApiAuthGuard } from "../sites/guards/rest-api-auth.guard";
import type { SiteRecord } from "../sites/sites.types";
import { CampaignsService } from "./campaigns.service";
import type { CampaignRecord } from "./campaigns.types";
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
      return { success: true, data: await this.createAndSend(site, dto, null) };
    }

    const normalizedIdempotencyKey = idempotencyKey.trim();
    if (!normalizedIdempotencyKey || normalizedIdempotencyKey.length > 200) {
      throw new BadRequestException("Idempotency-Key must contain between 1 and 200 characters");
    }

    // Reserve the key before doing any work, not after, so two requests
    // racing on the same key (a real client retry sent twice in flight,
    // not just sequentially) can't both pass the check and both send.
    const redisKey = `idempotency:rest-api-notifications:${site.id}:${normalizedIdempotencyKey}`;
    const reserved = await this.redis.set(redisKey, "PENDING", "EX", IDEMPOTENCY_TTL_SECONDS, "NX");

    if (reserved !== "OK") {
      const existing = await this.redis.get(redisKey);
      if (existing === "PENDING" || existing === null) {
        throw new ConflictException("A request with this idempotency key is already in progress");
      }

      const persisted = await this.campaignsService.findByExternalIdempotencyKey(
        site.id,
        normalizedIdempotencyKey,
      );
      if (persisted) {
        this.assertMatchingPayload(persisted, dto);
      }
      return { success: true, data: JSON.parse(existing) as SendNotificationResult };
    }

    try {
      const result = await this.createAndSend(site, dto, normalizedIdempotencyKey);
      await this.redis.set(redisKey, JSON.stringify(result), "EX", IDEMPOTENCY_TTL_SECONDS);
      return { success: true, data: result };
    } catch (error) {
      // Don't let a failed send permanently squat on the idempotency key --
      // a retry after a genuine failure should be allowed to try again.
      await this.redis.del(redisKey);
      throw error;
    }
  }

  private async createAndSend(
    site: SiteRecord,
    dto: SendRestApiNotificationDto,
    idempotencyKey: string | null,
  ): Promise<SendNotificationResult> {
    const queueJobId = idempotencyKey
      ? `crm-${createHash("sha256").update(`${site.id}\0${idempotencyKey}`).digest("hex").slice(0, 40)}`
      : undefined;
    const existingCampaign = idempotencyKey
      ? await this.campaignsService.findByExternalIdempotencyKey(site.id, idempotencyKey)
      : null;

    if (existingCampaign) {
      this.assertMatchingPayload(existingCampaign, dto);
      if (existingCampaign.status === "draft") {
        if (dto.callbackUrl) {
          await this.notificationCallbackService.register(site.id, existingCampaign.id, dto.callbackUrl);
        }
        const retried = await this.campaignsService.sendCampaign(existingCampaign.id, undefined, queueJobId);
        return { notificationId: existingCampaign.id, jobId: retried.jobId, queued: retried.queued };
      }

      return { notificationId: existingCampaign.id, jobId: queueJobId, queued: true };
    }

    let campaign: CampaignRecord;
    try {
      campaign = await this.campaignsService.createCampaign({
        siteId: site.id,
        name: dto.title,
        channel: "web",
        type: "instant",
        title: dto.title,
        message: dto.body,
        url: dto.url,
        ...(dto.icon !== undefined ? { iconUrl: dto.icon } : {}),
        ...(dto.image !== undefined ? { imageUrl: dto.image } : {}),
      }, undefined, idempotencyKey);
    } catch (error) {
      // Campaign insertion and its follow-up audit are separate writes. If the
      // insert committed but audit logging (or a concurrent request) failed,
      // recover the durable campaign keyed to this CRM event instead of making
      // the caller retry into a unique-key error.
      const persisted = idempotencyKey
        ? await this.campaignsService.findByExternalIdempotencyKey(site.id, idempotencyKey)
        : null;
      if (!persisted) {
        throw error;
      }
      this.assertMatchingPayload(persisted, dto);
      campaign = persisted;
    }

    if (dto.callbackUrl) {
      await this.notificationCallbackService.register(site.id, campaign.id, dto.callbackUrl);
    }

    const result = await this.campaignsService.sendCampaign(campaign.id, undefined, queueJobId);

    return { notificationId: campaign.id, jobId: result.jobId, queued: result.queued };
  }

  private assertMatchingPayload(
    campaign: Pick<CampaignRecord, "title" | "message" | "url" | "iconUrl" | "imageUrl">,
    dto: SendRestApiNotificationDto,
  ): void {
    if (
      campaign.title !== dto.title ||
      campaign.message !== dto.body ||
      campaign.url !== dto.url ||
      campaign.iconUrl !== (dto.icon ?? null) ||
      campaign.imageUrl !== (dto.image ?? null)
    ) {
      throw new ConflictException("Idempotency-Key has already been used with a different notification payload");
    }
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
