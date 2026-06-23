import { apiJson } from "../../lib/server-api";

export interface SiteChoice {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  status: "active" | "inactive";
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
}

// Only used when the /sites API is unreachable. "All Sites" (site-3) is a
// sentinel used throughout analytics/segments/automations to mean "no site
// filter" — keep its id stable even though the rest of this is placeholder.
export const fallbackSiteChoices: SiteChoice[] = [
  {
    id: "site-1",
    name: "Site A",
    url: "https://example.com",
    country: "Unknown",
    language: "en",
    status: "active",
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
  },
  {
    id: "site-2",
    name: "Site B",
    url: "https://example.org",
    country: "Unknown",
    language: "en",
    status: "active",
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
  },
  {
    id: "site-3",
    name: "All Sites",
    url: "",
    country: "Global",
    language: "en",
    status: "active",
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
  },
];

interface SiteApiResponse<T> {
  success: true;
  data: T;
}

export async function getSiteChoices(): Promise<SiteChoice[]> {
  const response = await apiJson<SiteApiResponse<{ items: SiteChoice[] }>>("/sites");
  const items = response?.data.items ?? fallbackSiteChoices;
  if (items.some((site) => site.id === "site-3")) {
    return items;
  }

  return [...items, fallbackSiteChoices.find((site) => site.id === "site-3") ?? fallbackSiteChoices[0]!];
}
