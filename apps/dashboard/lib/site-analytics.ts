import { apiJson } from "./server-api";
import type { SiteSummary } from "../app/sites/sites.utils";

interface SiteAnalyticsApiResponse {
  success: true;
  data: {
    totalSubscribers: number;
    activeSubscribers: number;
    last30Days: {
      totalPending: number;
      totalSent: number;
      totalDelivered: number;
      totalFailed: number;
      totalExpired: number;
      subscriberGrowth: Array<{ date: string; newSubscribers: number }>;
    };
  };
}

export interface SiteAnalyticsSummary {
  totalSubscribers: number;
  activeSubscribers: number;
  last30Days: {
    totalPending: number;
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalExpired: number;
    subscriberGrowth: Array<{ date: string; newSubscribers: number }>;
  };
}

// Never invent numbers here -- a prior version synthesized realistic-looking
// fake analytics from the site's subscriber count on any API failure, which
// made a real backend outage indistinguishable from genuine data.
function emptyAnalytics(site: SiteSummary): SiteAnalyticsSummary {
  return {
    totalSubscribers: site.subscribers,
    activeSubscribers: 0,
    last30Days: {
      totalPending: 0,
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalExpired: 0,
      subscriberGrowth: [],
    },
  };
}

export async function getSiteAnalytics(site: SiteSummary): Promise<SiteAnalyticsSummary> {
  const response = await apiJson<SiteAnalyticsApiResponse>(`/analytics/sites/${site.id}?days=30`);
  if (response?.data) {
    return response.data;
  }

  console.error(`[analytics] failed to load site analytics for ${site.id}`);
  return emptyAnalytics(site);
}

