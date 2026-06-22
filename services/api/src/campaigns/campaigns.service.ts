import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { BrowserPushService } from "../browser-push/browser-push.service";
import { CampaignMediaService } from "../campaign-media/campaign-media.service";
import { CampaignTaxonomiesService } from "../campaign-taxonomies/campaign-taxonomies.service";
import { SegmentsService } from "../segments/segments.service";
import { SitesService } from "../sites/sites.service";
import { computeNextOccurrence } from "./campaign-recurrence.util";
import { CAMPAIGNS_REPOSITORY } from "./campaigns.constants";
import type {
  CampaignButton,
  CampaignListFilters,
  CampaignListResult,
  CampaignRecord,
} from "./campaigns.types";
import type { CampaignsRepository, CreateCampaignInput, UpdateCampaignInput } from "./campaigns.repository";
import { CloneCampaignDto } from "./dto/clone-campaign.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { ListCampaignsQueryDto } from "./dto/list-campaigns-query.dto";
import { ScheduleCampaignDto } from "./dto/schedule-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

function toNullableDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function normalizeButtons(buttons: CreateCampaignDto["buttons"] | UpdateCampaignDto["buttons"]): CampaignButton[] {
  return (buttons ?? []).map((button) => ({
    label: button.label,
    url: button.url,
  }));
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly sitesService: SitesService,
    private readonly segmentsService: SegmentsService,
    private readonly browserPushService: BrowserPushService,
    private readonly campaignMediaService: CampaignMediaService,
    private readonly campaignTaxonomiesService: CampaignTaxonomiesService,
    private readonly auditService: AuditService,
    @Inject(CAMPAIGNS_REPOSITORY) private readonly campaignsRepository: CampaignsRepository,
  ) {}

  async createCampaign(dto: CreateCampaignDto, actorUserId?: string): Promise<CampaignRecord> {
    await this.sitesService.getSite(dto.siteId);
    if (dto.segmentId) {
      await this.assertSegmentBelongsToSite(dto.segmentId, dto.siteId);
    }
    await this.campaignTaxonomiesService.ensureActive(dto.contentType ?? "announcement");
    const media = await this.campaignMediaService.resolveCampaignMedia(dto.siteId, {
      ...(dto.imageAssetId !== undefined ? { imageAssetId: dto.imageAssetId } : {}),
      ...(dto.iconAssetId !== undefined ? { iconAssetId: dto.iconAssetId } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.iconUrl !== undefined ? { iconUrl: dto.iconUrl } : {}),
    });

    const campaign = await this.campaignsRepository.create(this.normalizeCreateInput(dto, media));
    await this.attachCampaignMedia(campaign.id, dto.imageAssetId, dto.iconAssetId);
    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "campaign.created",
      targetType: "campaign",
      targetId: campaign.id,
      metadata: { siteId: campaign.siteId, name: campaign.name },
    });
    return campaign;
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto, actorUserId?: string): Promise<CampaignRecord> {
    const existing = await this.getCampaign(id);
    if (dto.segmentId) {
      await this.assertSegmentBelongsToSite(dto.segmentId, existing.siteId);
    }
    if (dto.contentType) {
      await this.campaignTaxonomiesService.ensureActive(dto.contentType);
    }
    const media = await this.campaignMediaService.resolveCampaignMedia(existing.siteId, {
      ...(dto.imageAssetId !== undefined ? { imageAssetId: dto.imageAssetId } : {}),
      ...(dto.iconAssetId !== undefined ? { iconAssetId: dto.iconAssetId } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.iconUrl !== undefined ? { iconUrl: dto.iconUrl } : {}),
    });

    const updated = await this.campaignsRepository.update(id, this.normalizeUpdateInput(existing, dto, media));
    if (!updated) {
      throw new NotFoundException("Campaign not found");
    }
    await this.attachCampaignMedia(updated.id, dto.imageAssetId, dto.iconAssetId);

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "campaign.updated",
      targetType: "campaign",
      targetId: updated.id,
      metadata: { changes: dto },
    });

    return updated;
  }

  private async assertSegmentBelongsToSite(segmentId: string, siteId: string): Promise<void> {
    const segment = await this.segmentsService.getSegment(segmentId);
    if (segment.siteId !== siteId) {
      throw new BadRequestException("Segment does not belong to the campaign's site");
    }
  }

  async getCampaign(id: string): Promise<CampaignRecord> {
    const campaign = await this.campaignsRepository.findById(id);
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }

  async listCampaigns(filters: Partial<ListCampaignsQueryDto>): Promise<CampaignListResult> {
    const normalized: CampaignListFilters = {
      limit: filters.limit ?? 20,
      offset: filters.offset ?? 0,
    };

    if (filters.siteId) {
      normalized.siteId = filters.siteId;
    }
    if (filters.type) {
      normalized.type = filters.type;
    }
    if (filters.status) {
      normalized.status = filters.status;
    }
    if (filters.contentType) {
      normalized.contentType = filters.contentType;
    }

    return this.campaignsRepository.list(normalized);
  }

  async deleteCampaign(id: string, actorUserId?: string): Promise<void> {
    const existing = await this.getCampaign(id);
    await this.campaignMediaService.deleteCampaignAssets(existing.id);
    const deleted = await this.campaignsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException("Campaign not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "campaign.deleted",
      targetType: "campaign",
      targetId: id,
      metadata: { siteId: existing.siteId, name: existing.name },
    });
  }

  async cloneCampaign(id: string, dto: CloneCampaignDto, actorUserId?: string): Promise<CampaignRecord> {
    const existing = await this.getCampaign(id);
    await this.sitesService.getSite(existing.siteId);

    const cloned = await this.campaignsRepository.create({
      siteId: existing.siteId,
      segmentId: existing.segmentId,
      name: dto.name ?? `${existing.name} Copy`,
      contentType: existing.contentType,
      channel: existing.channel,
      type: existing.type,
      title: existing.title,
      message: existing.message,
      url: existing.url,
      imageUrl: existing.imageUrl,
      iconUrl: existing.iconUrl,
      buttons: existing.buttons,
      expirationAt: existing.expirationAt,
      status: "draft",
      scheduledAt: null,
      timezone: existing.timezone,
      recurrenceType: null,
      recurrenceInterval: null,
      recurrenceUntilAt: null,
      clonedFromCampaignId: existing.id,
      sentAt: null,
    });
    const clonedMedia = await this.campaignMediaService.cloneCampaignAssets(existing, cloned.id);
    if (clonedMedia.imageUrl !== cloned.imageUrl || clonedMedia.iconUrl !== cloned.iconUrl) {
      const updatedClone = await this.campaignsRepository.update(cloned.id, {
        imageUrl: clonedMedia.imageUrl,
        iconUrl: clonedMedia.iconUrl,
      });
      if (updatedClone) {
        cloned.imageUrl = updatedClone.imageUrl;
        cloned.iconUrl = updatedClone.iconUrl;
      }
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "campaign.cloned",
      targetType: "campaign",
      targetId: cloned.id,
      metadata: { clonedFromCampaignId: existing.id },
    });

    return cloned;
  }

  async previewCampaign(id: string): Promise<{ campaignId: string; preview: CampaignButton[]; title: string; message: string; url: string; imageUrl: string | null; iconUrl: string | null }> {
    const campaign = await this.getCampaign(id);
    return {
      campaignId: campaign.id,
      preview: campaign.buttons,
      title: campaign.title,
      message: campaign.message,
      url: campaign.url,
      imageUrl: campaign.imageUrl,
      iconUrl: campaign.iconUrl,
    };
  }

  async scheduleCampaign(id: string, dto: ScheduleCampaignDto, actorUserId?: string): Promise<CampaignRecord> {
    const existing = await this.getCampaign(id);
    const scheduled = await this.updateCampaign(id, {
      type: existing.type === "instant" && dto.recurrenceType ? "recurring" : existing.type,
      status: "scheduled",
      scheduledAt: dto.scheduledAt ?? existing.scheduledAt?.toISOString() ?? null,
      timezone: dto.timezone ?? existing.timezone,
      recurrenceType: dto.recurrenceType ?? existing.recurrenceType,
      recurrenceInterval: dto.recurrenceInterval ?? existing.recurrenceInterval,
      recurrenceUntilAt: dto.recurrenceUntilAt ?? existing.recurrenceUntilAt?.toISOString() ?? null,
    });

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "campaign.scheduled",
      targetType: "campaign",
      targetId: scheduled.id,
      metadata: { scheduledAt: scheduled.scheduledAt },
    });

    return scheduled;
  }

  async sendCampaign(id: string, actorUserId?: string): Promise<{ jobId: string | undefined; queued: true }> {
    const campaign = await this.getCampaign(id);

    if (campaign.status === "sending" || campaign.status === "sent") {
      throw new ConflictException(`Campaign is already ${campaign.status}`);
    }

    const result = await this.browserPushService.dispatch({
      siteId: campaign.siteId,
      title: campaign.title,
      body: campaign.message,
      url: campaign.url,
      icon: campaign.iconUrl,
      image: campaign.imageUrl,
      campaignId: campaign.id,
      segmentId: campaign.segmentId,
    });

    await this.campaignsRepository.update(id, { status: "sending" });

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "campaign.sent",
      targetType: "campaign",
      targetId: campaign.id,
      metadata: { siteId: campaign.siteId },
    });

    return result;
  }

  async dispatchScheduledOccurrence(campaign: CampaignRecord): Promise<{ jobId: string | undefined; queued: true }> {
    return this.browserPushService.dispatch({
      siteId: campaign.siteId,
      title: campaign.title,
      body: campaign.message,
      url: campaign.url,
      icon: campaign.iconUrl,
      image: campaign.imageUrl,
      campaignId: campaign.id,
      segmentId: campaign.segmentId,
    });
  }

  async listDueScheduledCampaigns(asOf: Date): Promise<CampaignRecord[]> {
    return this.campaignsRepository.listDueScheduledCampaigns(asOf);
  }

  async advanceRecurringCampaign(campaign: CampaignRecord): Promise<void> {
    if (!campaign.recurrenceType || !campaign.scheduledAt) {
      return;
    }

    const next = computeNextOccurrence(campaign.scheduledAt, campaign.recurrenceType, campaign.recurrenceInterval ?? 1);

    if (campaign.recurrenceUntilAt && next > campaign.recurrenceUntilAt) {
      await this.campaignsRepository.update(campaign.id, { status: "sent", sentAt: new Date() });
      return;
    }

    await this.campaignsRepository.update(campaign.id, { scheduledAt: next });
  }

  private async attachCampaignMedia(campaignId: string, imageAssetId?: string | null, iconAssetId?: string | null): Promise<void> {
    const assetIds = [imageAssetId, iconAssetId].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (assetIds.length === 0) {
      return;
    }

    await this.campaignMediaService.attachAssetsToCampaign(campaignId, assetIds);
  }

  private normalizeCreateInput(dto: CreateCampaignDto, media: { imageUrl: string | null; iconUrl: string | null }): CreateCampaignInput {
    return {
      siteId: dto.siteId,
      segmentId: dto.segmentId ?? null,
      name: dto.name,
      contentType: dto.contentType ?? "announcement",
      channel: dto.channel,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      url: dto.url,
      imageUrl: media.imageUrl,
      iconUrl: media.iconUrl,
      buttons: normalizeButtons(dto.buttons),
      expirationAt: toNullableDate(dto.expirationAt) ?? null,
      status: dto.status ?? "draft",
      scheduledAt: toNullableDate(dto.scheduledAt) ?? null,
      timezone: dto.timezone ?? null,
      recurrenceType: dto.recurrenceType ?? null,
      recurrenceInterval: dto.recurrenceInterval ?? null,
      recurrenceUntilAt: toNullableDate(dto.recurrenceUntilAt) ?? null,
      clonedFromCampaignId: null,
      sentAt: null,
    };
  }

  private normalizeUpdateInput(
    existing: CampaignRecord,
    dto: UpdateCampaignDto,
    media: { imageUrl: string | null; iconUrl: string | null },
  ): UpdateCampaignInput {
    return {
      ...(dto.segmentId !== undefined ? { segmentId: dto.segmentId } : {}),
      name: dto.name ?? existing.name,
      contentType: dto.contentType ?? existing.contentType,
      channel: dto.channel ?? existing.channel,
      type: dto.type ?? existing.type,
      title: dto.title ?? existing.title,
      message: dto.message ?? existing.message,
      url: dto.url ?? existing.url,
      imageUrl: dto.imageAssetId !== undefined || dto.imageUrl !== undefined ? media.imageUrl : existing.imageUrl,
      iconUrl: dto.iconAssetId !== undefined || dto.iconUrl !== undefined ? media.iconUrl : existing.iconUrl,
      buttons: dto.buttons ? normalizeButtons(dto.buttons) : existing.buttons,
      expirationAt: dto.expirationAt === undefined ? existing.expirationAt : (toNullableDate(dto.expirationAt) ?? null),
      status: dto.status ?? existing.status,
      scheduledAt:
        dto.scheduledAt === undefined ? existing.scheduledAt : (toNullableDate(dto.scheduledAt) ?? null),
      timezone: dto.timezone === undefined ? existing.timezone : dto.timezone,
      recurrenceType: dto.recurrenceType === undefined ? existing.recurrenceType : dto.recurrenceType,
      recurrenceInterval:
        dto.recurrenceInterval === undefined ? existing.recurrenceInterval : dto.recurrenceInterval,
      recurrenceUntilAt:
        dto.recurrenceUntilAt === undefined ? existing.recurrenceUntilAt : (toNullableDate(dto.recurrenceUntilAt) ?? null),
      clonedFromCampaignId: existing.clonedFromCampaignId,
      sentAt: existing.sentAt,
    };
  }
}
