import { apiJson } from "../../lib/server-api";

export interface SiteSummary {
  id: string;
  name: string;
  url: string;
  country: string;
  timezone: string | null;
  language: string;
  platform: "WordPress" | "Magento" | "Node.js" | "Laravel" | "Other";
  status: "active" | "inactive";
  subscribers: number;
  vapidPublicKey: string | null;
  appName: string;
  iconUrl: string;
  themeColor: string;
  optInPromptType: "lightbox-1" | "lightbox-2" | "bell-icon";
  optInPromptAnimation: "slide-in" | "fade-in" | "pop";
  optInPromptBackgroundColor: string;
  optInPromptHeadline: string;
  optInPromptHeadlineTextColor: string;
  optInPromptText: string;
  optInPromptTextColor: string;
  optInPromptIconUrl: string;
  optInPromptCancelButtonLabel: string;
  optInPromptCancelButtonTextColor: string;
  optInPromptCancelButtonBackgroundColor: string;
  optInPromptApproveButtonLabel: string;
  optInPromptApproveButtonTextColor: string;
  optInPromptApproveButtonBackgroundColor: string;
  optInPromptRepromptDelayDays: number;
  optInPromptRecentNotificationsLimit: number;
  restApiKeyId: string | null;
  restApiAuthTokenLast4: string | null;
  restApiCredentialsGeneratedAt: string | null;
  lastConnectedAt: string | null;
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
  timezone?: string | null;
  language: string;
  platform: SiteSummary["platform"];
  status: "active" | "inactive";
  vapidPublicKey: string | null;
  appName?: string;
  iconUrl?: string;
  themeColor?: string;
  optInPromptType?: SiteSummary["optInPromptType"];
  optInPromptAnimation?: SiteSummary["optInPromptAnimation"];
  optInPromptBackgroundColor?: string;
  optInPromptHeadline?: string;
  optInPromptHeadlineTextColor?: string;
  optInPromptText?: string;
  optInPromptTextColor?: string;
  optInPromptIconUrl?: string;
  optInPromptCancelButtonLabel?: string;
  optInPromptCancelButtonTextColor?: string;
  optInPromptCancelButtonBackgroundColor?: string;
  optInPromptApproveButtonLabel?: string;
  optInPromptApproveButtonTextColor?: string;
  optInPromptApproveButtonBackgroundColor?: string;
  optInPromptRepromptDelayDays?: number;
  optInPromptRecentNotificationsLimit?: number;
  restApiKeyId?: string | null;
  restApiAuthTokenLast4?: string | null;
  restApiCredentialsGeneratedAt?: string | null;
  lastConnectedAt?: string | null;
  subscriberCount?: number;
}

// Only rendered when the /sites API is unreachable. "All Sites" (site-3) is a
// sentinel used throughout analytics/segments/automations to mean "no site
// filter" — keep its id stable even though the rest of this is placeholder.
const fallbackSites: SiteSummary[] = [
  {
    id: "site-1",
    name: "Site A",
    url: "https://example.com",
    country: "Unknown",
    timezone: "UTC",
    language: "en",
    platform: "WordPress",
    status: "active",
    subscribers: 0,
    vapidPublicKey: null,
    appName: "Site A",
    iconUrl: "",
    themeColor: "#1c1917",
    optInPromptType: "lightbox-1",
    optInPromptAnimation: "slide-in",
    optInPromptBackgroundColor: "#ffffff",
    optInPromptHeadline: "Stay in the loop",
    optInPromptHeadlineTextColor: "#111111",
    optInPromptText: "Get important updates delivered to your browser.",
    optInPromptTextColor: "#444444",
    optInPromptIconUrl: "",
    optInPromptCancelButtonLabel: "Not now",
    optInPromptCancelButtonTextColor: "#ffffff",
    optInPromptCancelButtonBackgroundColor: "#111111",
    optInPromptApproveButtonLabel: "Enable",
    optInPromptApproveButtonTextColor: "#ffffff",
    optInPromptApproveButtonBackgroundColor: "#ea580c",
    optInPromptRepromptDelayDays: 30,
    optInPromptRecentNotificationsLimit: 3,
    restApiKeyId: null,
    restApiAuthTokenLast4: null,
    restApiCredentialsGeneratedAt: null,
    lastConnectedAt: null,
  },
  {
    id: "site-2",
    name: "Site B",
    url: "https://example.org",
    country: "Unknown",
    timezone: "UTC",
    language: "en",
    platform: "Laravel",
    status: "active",
    subscribers: 0,
    vapidPublicKey: null,
    appName: "Site B",
    iconUrl: "",
    themeColor: "#1c1917",
    optInPromptType: "lightbox-2",
    optInPromptAnimation: "fade-in",
    optInPromptBackgroundColor: "#f8fafc",
    optInPromptHeadline: "Never miss an update",
    optInPromptHeadlineTextColor: "#0f172a",
    optInPromptText: "Allow notifications to get the latest updates.",
    optInPromptTextColor: "#334155",
    optInPromptIconUrl: "",
    optInPromptCancelButtonLabel: "Later",
    optInPromptCancelButtonTextColor: "#ffffff",
    optInPromptCancelButtonBackgroundColor: "#111827",
    optInPromptApproveButtonLabel: "Yes, notify me",
    optInPromptApproveButtonTextColor: "#ffffff",
    optInPromptApproveButtonBackgroundColor: "#0ea5e9",
    optInPromptRepromptDelayDays: 14,
    optInPromptRecentNotificationsLimit: 3,
    restApiKeyId: null,
    restApiAuthTokenLast4: null,
    restApiCredentialsGeneratedAt: null,
    lastConnectedAt: null,
  },
  {
    id: "site-3",
    name: "All Sites",
    url: "",
    country: "Global",
    timezone: "UTC",
    language: "en",
    platform: "Other",
    status: "active",
    subscribers: 0,
    vapidPublicKey: null,
    appName: "Exotic Push Engine",
    iconUrl: "",
    themeColor: "#1c1917",
    optInPromptType: "bell-icon",
    optInPromptAnimation: "pop",
    optInPromptBackgroundColor: "#ffffff",
    optInPromptHeadline: "Get browser notifications",
    optInPromptHeadlineTextColor: "#111111",
    optInPromptText: "Choose a custom prompt for each site.",
    optInPromptTextColor: "#52525b",
    optInPromptIconUrl: "",
    optInPromptCancelButtonLabel: "Dismiss",
    optInPromptCancelButtonTextColor: "#ffffff",
    optInPromptCancelButtonBackgroundColor: "#27272a",
    optInPromptApproveButtonLabel: "Allow",
    optInPromptApproveButtonTextColor: "#ffffff",
    optInPromptApproveButtonBackgroundColor: "#ea580c",
    optInPromptRepromptDelayDays: 30,
    optInPromptRecentNotificationsLimit: 3,
    restApiKeyId: null,
    restApiAuthTokenLast4: null,
    restApiCredentialsGeneratedAt: null,
    lastConnectedAt: null,
  },
];

function toSiteSummary(record: ApiSiteRecord, subscribers?: number): SiteSummary {
  return {
    id: record.id,
    name: record.name,
    url: record.url,
    country: record.country,
    timezone: record.timezone ?? null,
    language: record.language,
    platform: record.platform,
    status: record.status,
    subscribers: subscribers ?? record.subscriberCount ?? 0,
    vapidPublicKey: record.vapidPublicKey,
    appName: record.appName ?? record.name,
    iconUrl: record.iconUrl ?? "",
    themeColor: record.themeColor ?? "#1c1917",
    optInPromptType: record.optInPromptType ?? "lightbox-1",
    optInPromptAnimation: record.optInPromptAnimation ?? "slide-in",
    optInPromptBackgroundColor: record.optInPromptBackgroundColor ?? "#ffffff",
    optInPromptHeadline: record.optInPromptHeadline ?? "Stay in the loop",
    optInPromptHeadlineTextColor: record.optInPromptHeadlineTextColor ?? "#111111",
    optInPromptText: record.optInPromptText ?? "Get important updates delivered to your browser.",
    optInPromptTextColor: record.optInPromptTextColor ?? "#444444",
    optInPromptIconUrl: record.optInPromptIconUrl ?? "",
    optInPromptCancelButtonLabel: record.optInPromptCancelButtonLabel ?? "Not now",
    optInPromptCancelButtonTextColor: record.optInPromptCancelButtonTextColor ?? "#ffffff",
    optInPromptCancelButtonBackgroundColor: record.optInPromptCancelButtonBackgroundColor ?? "#111111",
    optInPromptApproveButtonLabel: record.optInPromptApproveButtonLabel ?? "Enable",
    optInPromptApproveButtonTextColor: record.optInPromptApproveButtonTextColor ?? "#ffffff",
    optInPromptApproveButtonBackgroundColor: record.optInPromptApproveButtonBackgroundColor ?? "#ea580c",
    optInPromptRepromptDelayDays: record.optInPromptRepromptDelayDays ?? 30,
    optInPromptRecentNotificationsLimit: record.optInPromptRecentNotificationsLimit ?? 3,
    restApiKeyId: record.restApiKeyId ?? null,
    restApiAuthTokenLast4: record.restApiAuthTokenLast4 ?? null,
    restApiCredentialsGeneratedAt: record.restApiCredentialsGeneratedAt ?? null,
    lastConnectedAt: record.lastConnectedAt ?? null,
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
  return toSiteSummary(response.data, analytics?.data.totalSubscribers ?? response.data.subscriberCount ?? 0);
}

export function getFallbackSiteChoices(): SiteSummary[] {
  return fallbackSites;
}

export { getConnectionStatus } from "./connection-status";
