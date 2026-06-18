import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { BrowserPushService } from "../browser-push/browser-push.service";
import { SitesService } from "../sites/sites.service";
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
    private readonly browserPushService: BrowserPushService,
    @Inject(CAMPAIGNS_REPOSITORY) private readonly campaignsRepository: CampaignsRepository,
  ) {}

  async createCampaign(dto: CreateCampaignDto): Promise<CampaignRecord> {
    await this.sitesService.getSite(dto.siteId);
    return this.campaignsRepository.create(this.normalizeCreateInput(dto));
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto): Promise<CampaignRecord> {
    const existing = await this.getCampaign(id);
    const updated = await this.campaignsRepository.update(id, this.normalizeUpdateInput(existing, dto));
    if (!updated) {
      throw new NotFoundException("Campaign not found");
    }

    return updated;
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

    return this.campaignsRepository.list(normalized);
  }

  async deleteCampaign(id: string): Promise<void> {
    const deleted = await this.campaignsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException("Campaign not found");
    }
  }

  async cloneCampaign(id: string, dto: CloneCampaignDto): Promise<CampaignRecord> {
    const existing = await this.getCampaign(id);
    await this.sitesService.getSite(existing.siteId);

    return this.campaignsRepository.create({
      siteId: existing.siteId,
      name: dto.name ?? `${existing.name} Copy`,
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

  async scheduleCampaign(id: string, dto: ScheduleCampaignDto): Promise<CampaignRecord> {
    const existing = await this.getCampaign(id);
    return this.updateCampaign(id, {
      type: existing.type === "instant" && dto.recurrenceType ? "recurring" : existing.type,
      status: "scheduled",
      scheduledAt: dto.scheduledAt ?? existing.scheduledAt?.toISOString() ?? null,
      timezone: dto.timezone ?? existing.timezone,
      recurrenceType: dto.recurrenceType ?? existing.recurrenceType,
      recurrenceInterval: dto.recurrenceInterval ?? existing.recurrenceInterval,
      recurrenceUntilAt: dto.recurrenceUntilAt ?? existing.recurrenceUntilAt?.toISOString() ?? null,
    });
  }

  async sendCampaign(id: string): Promise<{ jobId: string | undefined; queued: true }> {
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
    });

    await this.campaignsRepository.update(id, { status: "sending" });

    return result;
  }

  private normalizeCreateInput(dto: CreateCampaignDto): CreateCampaignInput {
    return {
      siteId: dto.siteId,
      name: dto.name,
      channel: dto.channel,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      url: dto.url,
      imageUrl: dto.imageUrl ?? null,
      iconUrl: dto.iconUrl ?? null,
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

  private normalizeUpdateInput(existing: CampaignRecord, dto: UpdateCampaignDto): UpdateCampaignInput {
    return {
      name: dto.name ?? existing.name,
      channel: dto.channel ?? existing.channel,
      type: dto.type ?? existing.type,
      title: dto.title ?? existing.title,
      message: dto.message ?? existing.message,
      url: dto.url ?? existing.url,
      imageUrl: dto.imageUrl === undefined ? existing.imageUrl : dto.imageUrl,
      iconUrl: dto.iconUrl === undefined ? existing.iconUrl : dto.iconUrl,
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
