import { apiJson } from "../../lib/server-api";

export interface SiteSummary {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  platform: "WordPress" | "Magento" | "Node.js" | "Laravel" | "Other";
  status: "active" | "inactive";
  subscribers: number;
  vapidPublicKey: string | null;
}

export interface SiteListPayload {
  items: SiteSummary[];
  total: number;
}

interface SiteApiResponse<T> {
  success: true;
  data: T;
}

interface ApiSiteRecord {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  platform: SiteSummary["platform"];
  status: "active" | "inactive";
  vapidPublicKey: string | null;
}

const fallbackSites: SiteSummary[] = [
  {
    id: "site-1",
    name: "Exotic Africa",
    url: "https://exotic-africa.com",
    country: "South Africa",
    language: "en",
    platform: "WordPress",
    status: "active",
    subscribers: 2418400,
    vapidPublicKey: "BExoticKey1",
  },
  {
    id: "site-2",
    name: "Zebra Travel",
    url: "https://zebra-travel.co.za",
    country: "Kenya",
    language: "en",
    platform: "Laravel",
    status: "active",
    subscribers: 1184200,
    vapidPublicKey: "BExoticKey2",
  },
  {
    id: "site-3",
    name: "All Sites",
    url: "https://exotic.example",
    country: "Global",
    language: "en",
    platform: "Other",
    status: "active",
    subscribers: 4200000,
    vapidPublicKey: "BExoticKey3",
  },
];

function toSiteSummary(record: ApiSiteRecord, subscribers = 0): SiteSummary {
  return {
    id: record.id,
    name: record.name,
    url: record.url,
    country: record.country,
    language: record.language,
    platform: record.platform,
    status: record.status,
    subscribers,
    vapidPublicKey: record.vapidPublicKey,
  };
}

export async function getSiteList(): Promise<SiteListPayload> {
  const response = await apiJson<SiteApiResponse<{ items: ApiSiteRecord[] }>>("/sites");
  if (!response?.data.items) {
    return { items: fallbackSites, total: fallbackSites.length };
  }

  const items = response.data.items.map((record) => toSiteSummary(record));
  return { items, total: items.length };
}

export async function getSiteById(id: string): Promise<SiteSummary | null> {
  const response = await apiJson<SiteApiResponse<ApiSiteRecord>>(`/sites/${id}`);
  if (!response?.data) {
    return fallbackSites.find((site) => site.id === id) ?? null;
  }

  const analytics = await apiJson<SiteApiResponse<{ totalSubscribers: number }>>(`/analytics/sites/${id}`);
  return toSiteSummary(response.data, analytics?.data.totalSubscribers ?? 0);
}

export function getFallbackSiteChoices(): SiteSummary[] {
  return fallbackSites;
}
