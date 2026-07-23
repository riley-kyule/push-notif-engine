import { randomUUID } from "node:crypto";

import type {
  CampaignListFilters,
  CampaignListResult,
  CampaignRecord,
} from "./campaigns.types";
import type { CampaignsRepository, CreateCampaignInput, UpdateCampaignInput } from "./campaigns.repository";

function cloneCampaign(campaign: CampaignRecord): CampaignRecord {
  return {
    ...campaign,
    buttons: campaign.buttons.map((button) => ({ ...button })),
    abVariants: campaign.abVariants.map((variant) => ({ ...variant })),
  };
}

export class InMemoryCampaignsRepository implements CampaignsRepository {
  public readonly campaigns: CampaignRecord[] = [];

  async create(input: CreateCampaignInput): Promise<CampaignRecord> {
    const now = new Date();
    const campaign: CampaignRecord = {
      id: randomUUID(),
      siteId: input.siteId,
      segmentId: input.segmentId,
      name: input.name,
      contentType: input.contentType,
      channel: input.channel,
      type: input.type,
      title: input.title,
      message: input.message,
      url: input.url,
      imageUrl: input.imageUrl,
      iconUrl: input.iconUrl,
      buttons: input.buttons.map((button) => ({ ...button })),
      abVariants: input.abVariants.map((variant) => ({ ...variant })),
      expirationAt: input.expirationAt,
      status: input.status,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
      recurrenceType: input.recurrenceType,
      recurrenceInterval: input.recurrenceInterval,
      recurrenceUntilAt: input.recurrenceUntilAt,
      clonedFromCampaignId: input.clonedFromCampaignId,
      sentAt: input.sentAt,
      createdAt: now,
      updatedAt: now,
    };

    this.campaigns.push(campaign);
    return cloneCampaign(campaign);
  }

  async update(id: string, input: UpdateCampaignInput): Promise<CampaignRecord | null> {
    const campaign = this.campaigns.find((entry) => entry.id === id);
    if (!campaign) {
      return null;
    }

    campaign.segmentId = input.segmentId === undefined ? campaign.segmentId : input.segmentId;
    campaign.name = input.name ?? campaign.name;
    campaign.contentType = input.contentType ?? campaign.contentType;
    campaign.channel = input.channel ?? campaign.channel;
    campaign.type = input.type ?? campaign.type;
    campaign.title = input.title ?? campaign.title;
    campaign.message = input.message ?? campaign.message;
    campaign.url = input.url ?? campaign.url;
    campaign.imageUrl = input.imageUrl === undefined ? campaign.imageUrl : input.imageUrl;
    campaign.iconUrl = input.iconUrl === undefined ? campaign.iconUrl : input.iconUrl;
    campaign.buttons = input.buttons ? input.buttons.map((button) => ({ ...button })) : campaign.buttons;
    campaign.abVariants = input.abVariants ? input.abVariants.map((variant) => ({ ...variant })) : campaign.abVariants;
    campaign.expirationAt = input.expirationAt === undefined ? campaign.expirationAt : input.expirationAt;
    campaign.status = input.status ?? campaign.status;
    campaign.scheduledAt = input.scheduledAt === undefined ? campaign.scheduledAt : input.scheduledAt;
    campaign.timezone = input.timezone === undefined ? campaign.timezone : input.timezone;
    campaign.recurrenceType = input.recurrenceType === undefined ? campaign.recurrenceType : input.recurrenceType;
    campaign.recurrenceInterval =
      input.recurrenceInterval === undefined ? campaign.recurrenceInterval : input.recurrenceInterval;
    campaign.recurrenceUntilAt =
      input.recurrenceUntilAt === undefined ? campaign.recurrenceUntilAt : input.recurrenceUntilAt;
    campaign.clonedFromCampaignId =
      input.clonedFromCampaignId === undefined ? campaign.clonedFromCampaignId : input.clonedFromCampaignId;
    campaign.sentAt = input.sentAt === undefined ? campaign.sentAt : input.sentAt;
    campaign.updatedAt = new Date();

    return cloneCampaign(campaign);
  }

  async findById(id: string): Promise<CampaignRecord | null> {
    const campaign = this.campaigns.find((entry) => entry.id === id);
    return campaign ? cloneCampaign(campaign) : null;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.campaigns.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return false;
    }

    this.campaigns.splice(index, 1);
    return true;
  }

  async list(filters: CampaignListFilters): Promise<CampaignListResult> {
    const matches = (campaign: CampaignRecord): boolean =>
      (!filters.siteId || campaign.siteId === filters.siteId) &&
      (!filters.type || campaign.type === filters.type) &&
      (!filters.status || campaign.status === filters.status) &&
      (!filters.contentType || campaign.contentType === filters.contentType);

    const sortAccessors: Record<NonNullable<CampaignListFilters["sortBy"]>, (campaign: CampaignRecord) => string | number> = {
      name: (campaign) => campaign.name,
      type: (campaign) => campaign.type,
      status: (campaign) => campaign.status,
      scheduledAt: (campaign) => campaign.scheduledAt?.getTime() ?? -Infinity,
      sentAt: (campaign) => campaign.sentAt?.getTime() ?? -Infinity,
      createdAt: (campaign) => campaign.createdAt.getTime(),
    };
    const sortAccessor = sortAccessors[filters.sortBy ?? "createdAt"];
    const sortDir = filters.sortDir === "asc" ? 1 : -1;

    const filtered = this.campaigns.filter(matches);
    const sorted = [...filtered].sort((left, right) => {
      const leftValue = sortAccessor(left);
      const rightValue = sortAccessor(right);
      if (leftValue < rightValue) return -1 * sortDir;
      if (leftValue > rightValue) return 1 * sortDir;
      return 0;
    });

    const items = sorted.slice(filters.offset, filters.offset + filters.limit).map((campaign) => cloneCampaign(campaign));

    return { items, total: filtered.length };
  }

  async listDueScheduledCampaigns(asOf: Date): Promise<CampaignRecord[]> {
    return this.campaigns
      .filter((campaign) => campaign.status === "scheduled" && campaign.scheduledAt !== null && campaign.scheduledAt <= asOf)
      .sort((a, b) => (a.scheduledAt as Date).getTime() - (b.scheduledAt as Date).getTime())
      .map((campaign) => cloneCampaign(campaign));
  }

  async listRecentSentBySite(siteId: string, limit: number): Promise<CampaignRecord[]> {
    return this.campaigns
      .filter((campaign) => campaign.siteId === siteId)
      .filter((campaign) => campaign.sentAt !== null)
      .sort((a, b) => (b.sentAt as Date).getTime() - (a.sentAt as Date).getTime())
      .slice(0, limit)
      .map((campaign) => cloneCampaign(campaign));
  }
}
