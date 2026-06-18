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

function getApiBaseUrl(): string {
  return process.env.DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getSiteList(): Promise<SiteListPayload> {
  const response = await fetchJson<SiteApiResponse<{ items: Array<SiteSummary> }>>("/dashboard/sites");
  const items = response?.data.items ?? fallbackSites;
  return { items, total: items.length };
}

export async function getSiteById(id: string): Promise<SiteSummary | null> {
  const response = await fetchJson<SiteApiResponse<SiteSummary>>(`/dashboard/sites/${id}`);
  if (response?.data) {
    return response.data;
  }
  return fallbackSites.find((site) => site.id === id) ?? null;
}

export function getFallbackSiteChoices(): SiteSummary[] {
  return fallbackSites;
}
