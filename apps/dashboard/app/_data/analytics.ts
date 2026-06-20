import { getCampaignById, getCampaignList, type CampaignDetail, type CampaignSummary } from "./campaigns";
import { getDashboardOverview, type DashboardOverview } from "./overview";
import { getSiteList, getSiteById, type SiteSummary } from "../sites/sites.utils";
import { getSiteAnalytics, type SiteAnalyticsSummary } from "../../lib/site-analytics";

export type AnalyticsDays = 1 | 7 | 30 | 90;

export interface AnalyticsDashboardData {
  days: AnalyticsDays;
  rangeLabel: string;
  overview: DashboardOverview;
  sites: SiteSummary[];
  selectedSite: SiteSummary;
  siteAnalytics: SiteAnalyticsSummary;
  campaigns: CampaignSummary[];
  selectedCampaign: CampaignDetail | null;
}

const rangeLabels: Record<AnalyticsDays, string> = {
  1: "Today",
  7: "Last 7 days",
  30: "Last 30 days",
  90: "Last 90 days",
};

function normalizeDays(value?: string): AnalyticsDays {
  const parsed = Number.parseInt(value ?? "30", 10);
  if (parsed === 1 || parsed === 7 || parsed === 30 || parsed === 90) {
    return parsed;
  }

  return 30;
}

export async function getAnalyticsDashboardData(input: {
  days?: string;
  siteId?: string;
  campaignId?: string;
}): Promise<AnalyticsDashboardData> {
  const days = normalizeDays(input.days);
  const [overview, sitesPayload, campaignsPayload] = await Promise.all([
    getDashboardOverview(days),
    getSiteList(),
    getCampaignList(),
  ]);

  const sites = sitesPayload.items;
  const selectedSite = ((input.siteId ? await getSiteById(input.siteId) : null) ?? sites[0] ?? null);
  if (!selectedSite) {
    throw new Error("No sites available for analytics reporting.");
  }
  const selectedCampaign =
    (input.campaignId ? await getCampaignById(input.campaignId) : null) ?? (campaignsPayload.items[0] ? await getCampaignById(campaignsPayload.items[0].id) : null);

  const siteAnalytics = await getSiteAnalytics(selectedSite);

  return {
    days,
    rangeLabel: rangeLabels[days],
    overview,
    sites,
    selectedSite,
    siteAnalytics,
    campaigns: campaignsPayload.items,
    selectedCampaign,
  };
}
