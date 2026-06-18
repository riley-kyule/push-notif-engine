import { randomUUID } from "node:crypto";

import { campaignDetails, campaignSummaries } from "../../_data/campaigns";
import { fallbackSiteChoices } from "../../_data/sites";

export interface DashboardSiteRecord {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  status: "active" | "inactive";
  platform: string;
  subscribers: number;
  vapidPublicKey: string | null;
}

export interface DashboardSiteInput {
  name: string;
  url: string;
  country: string;
  language: string;
  status: "active" | "inactive";
  platform: string;
  subscribers?: number;
  vapidPublicKey?: string | null;
}

export interface DashboardCampaignRecord {
  id: string;
  siteId: string;
  name: string;
  channel: "web" | "mobile" | "all";
  type: "instant" | "scheduled" | "recurring";
  title: string;
  message: string;
  url: string;
  imageUrl: string | null;
  iconUrl: string | null;
  buttons: Array<{ label: string; url: string }>;
  expirationAt: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "expired";
  scheduledAt: string | null;
  timezone: string | null;
  recurrenceType: "daily" | "weekly" | "monthly" | null;
  recurrenceInterval: number | null;
  recurrenceUntilAt: string | null;
  clonedFromCampaignId: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function seedCampaigns(): Map<string, DashboardCampaignRecord> {
  const records = new Map<string, DashboardCampaignRecord>();
  const now = new Date().toISOString();

  for (const item of campaignSummaries) {
    const detail = campaignDetails[item.id];
    records.set(item.id, {
      id: item.id,
      siteId: item.site === "all sites" ? "site-3" : item.site === "exotic-africa.com" ? "site-1" : "site-2",
      name: item.name,
      channel: "web",
      type: item.type,
      title: detail?.title ?? item.name,
      message: detail?.message ?? "",
      url: detail?.url ?? "https://example.com",
      imageUrl: "imageLabel" in (detail ?? {}) ? "https://example.com/hero.png" : null,
      iconUrl: "iconLabel" in (detail ?? {}) ? "https://example.com/icon.png" : null,
      buttons: detail?.buttons ?? [],
      expirationAt: null,
      status: item.status,
      scheduledAt: item.scheduledAt === "Draft" ? null : now,
      timezone: "Africa/Nairobi",
      recurrenceType: item.type === "recurring" ? "weekly" : null,
      recurrenceInterval: item.type === "recurring" ? 1 : null,
      recurrenceUntilAt: null,
      clonedFromCampaignId: null,
      sentAt: item.status === "sent" ? now : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return records;
}

const state: {
  sites: DashboardSiteRecord[];
  campaigns: Map<string, DashboardCampaignRecord>;
} = {
  sites: fallbackSiteChoices.map((site, index) => ({
    ...site,
    platform: index === 0 ? "WordPress" : index === 1 ? "Laravel" : "Other",
    subscribers: index === 0 ? 2418400 : index === 1 ? 1184200 : 4200000,
    vapidPublicKey: index === 0 ? "BExoticKey1" : index === 1 ? "BExoticKey2" : "BExoticKey3",
  })),
  campaigns: seedCampaigns(),
};

function toSummary(record: DashboardCampaignRecord) {
  return {
    id: record.id,
    name: record.name,
    site: state.sites.find((site) => site.id === record.siteId)?.name ?? record.siteId,
    type: record.type,
    status: record.status,
    sent: record.sentAt ? "Sent" : "0",
    ctr: record.status === "sent" ? "7.8%" : "0%",
    scheduledAt:
      record.status === "draft"
        ? "Draft"
        : record.scheduledAt
          ? new Date(record.scheduledAt).toLocaleString()
          : "Scheduled",
  };
}

function toDetail(record: DashboardCampaignRecord) {
  const summary = toSummary(record);
  return {
    ...summary,
    title: record.title,
    message: record.message,
    url: record.url,
    imageUrl: record.imageUrl,
    iconUrl: record.iconUrl,
    imageLabel: record.imageUrl ? "Hero image" : "Image not set",
    iconLabel: record.iconUrl ? "Brand icon" : "Icon not set",
    buttons: record.buttons,
    metrics: {
      sent: record.sentAt ? "184,311" : "0",
      delivered: record.sentAt ? "181,990" : "0",
      clicks: record.sentAt ? "14,187" : "0",
      ctr: record.sentAt ? "7.8%" : "0%",
    },
    timeline: [
      { label: "Created", value: new Date(record.createdAt).toLocaleString(), tone: "neutral" as const },
      { label: "Status", value: record.status, tone: record.status === "sent" ? "success" : "warning" as const },
    ],
  };
}

export function listSites() {
  return state.sites.map((site) => ({ ...site }));
}

export function getSite(id: string) {
  const site = state.sites.find((item) => item.id === id);
  return site ? { ...site } : null;
}

export function createSite(input: DashboardSiteInput) {
  const site: DashboardSiteRecord = {
    id: randomUUID(),
    name: input.name,
    url: input.url,
    country: input.country,
    language: input.language,
    status: input.status,
    platform: input.platform,
    subscribers: input.subscribers ?? 0,
    vapidPublicKey: input.vapidPublicKey ?? null,
  };

  state.sites = [...state.sites, site];
  return { ...site };
}

export function updateSite(id: string, input: Partial<DashboardSiteInput>) {
  const index = state.sites.findIndex((item) => item.id === id);
  if (index < 0) {
    return null;
  }

  const current = state.sites[index];
  if (!current) {
    return null;
  }

  const updated: DashboardSiteRecord = {
    id: current.id,
    name: input.name ?? current.name,
    url: input.url ?? current.url,
    country: input.country ?? current.country,
    language: input.language ?? current.language,
    status: input.status ?? current.status,
    platform: input.platform ?? current.platform,
    subscribers: input.subscribers ?? current.subscribers,
    vapidPublicKey:
      input.vapidPublicKey === undefined ? current.vapidPublicKey : input.vapidPublicKey,
  };

  state.sites[index] = updated;
  return { ...updated };
}

export function deleteSite(id: string) {
  const next = state.sites.filter((site) => site.id !== id);
  if (next.length === state.sites.length) {
    return false;
  }

  state.sites = next;
  return true;
}

export function listCampaigns() {
  return Array.from(state.campaigns.values()).map((campaign) => toSummary(campaign));
}

export function getCampaign(id: string) {
  const campaign = state.campaigns.get(id);
  return campaign ? toDetail(campaign) : null;
}

export function createCampaign(input: {
  siteId: string;
  name: string;
  channel: "web" | "mobile" | "all";
  type: "instant" | "scheduled" | "recurring";
  title: string;
  message: string;
  url: string;
  imageUrl: string | null;
  iconUrl: string | null;
  buttons: Array<{ label: string; url: string }>;
  expirationAt: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "expired";
  scheduledAt: string | null;
  timezone: string | null;
  recurrenceType: "daily" | "weekly" | "monthly" | null;
  recurrenceInterval: number | null;
  recurrenceUntilAt: string | null;
  clonedFromCampaignId: string | null;
  sentAt: string | null;
}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: DashboardCampaignRecord = {
    id,
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  state.campaigns.set(id, record);
  return toDetail(record);
}

export function updateCampaign(
  id: string,
  input: Partial<Pick<DashboardCampaignRecord, "name" | "channel" | "type" | "title" | "message" | "url" | "imageUrl" | "iconUrl" | "buttons" | "expirationAt" | "status" | "scheduledAt" | "timezone" | "recurrenceType" | "recurrenceInterval" | "recurrenceUntilAt" | "clonedFromCampaignId" | "sentAt">>,
) {
  const existing = state.campaigns.get(id);
  if (!existing) {
    return null;
  }

  const updated: DashboardCampaignRecord = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  state.campaigns.set(id, updated);
  return toDetail(updated);
}

export function deleteCampaign(id: string) {
  return state.campaigns.delete(id);
}

export function cloneCampaign(id: string, name?: string) {
  const existing = state.campaigns.get(id);
  if (!existing) {
    return null;
  }

  return createCampaign({
    siteId: existing.siteId,
    name: name ?? `${existing.name} Copy`,
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

export function scheduleCampaign(
  id: string,
  input: {
    scheduledAt?: string | null;
    timezone?: string | null;
    recurrenceType?: "daily" | "weekly" | "monthly" | null;
    recurrenceInterval?: number | null;
    recurrenceUntilAt?: string | null;
  },
) {
  return updateCampaign(id, {
    status: "scheduled",
    scheduledAt: input.scheduledAt ?? null,
    timezone: input.timezone ?? null,
    recurrenceType: input.recurrenceType ?? null,
    recurrenceInterval: input.recurrenceInterval ?? null,
    recurrenceUntilAt: input.recurrenceUntilAt ?? null,
  });
}
