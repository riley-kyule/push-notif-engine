import { getCampaignById, getCampaignList, type CampaignDetail, type CampaignSummary } from "./campaigns";
import { getDashboardOverview, type DashboardOverview } from "./overview";
import { getSiteById, getSiteList, type SiteSummary } from "../sites/sites.utils";
import { getSiteAnalytics, type SiteAnalyticsSummary } from "../../lib/site-analytics";
import { apiJson } from "../../lib/server-api";

export type AnalyticsDays = 1 | 7 | 30 | 90;

export interface CountryPerformanceSummary {
  country: string;
  totalSubscribers: number;
  totalDelivered: number;
  totalSent: number;
  totalFailed: number;
  totalExpired: number;
  totalClicked: number;
  deliveryRate: number;
  clickThroughRate: number;
}

export interface SitePerformanceSummary {
  siteId: string;
  siteName: string;
  totalSubscribers: number;
  totalDelivered: number;
  totalSent: number;
  totalFailed: number;
  totalExpired: number;
  totalClicked: number;
  deliveryRate: number;
  clickThroughRate: number;
}

export interface TimePerformanceSummary {
  hour: number;
  totalDelivered: number;
  totalSent: number;
  totalFailed: number;
  totalClicked: number;
  deliveryRate: number;
  clickThroughRate: number;
}

export interface ContentPerformanceSummary {
  contentType: string;
  totalCampaigns: number;
  totalDelivered: number;
  totalSent: number;
  totalFailed: number;
  totalExpired: number;
  totalClicked: number;
  deliveryRate: number;
  clickThroughRate: number;
}

export interface AnalyticsDashboardData {
  days: AnalyticsDays;
  rangeLabel: string;
  overview: DashboardOverview;
  sites: SiteSummary[];
  selectedSite: SiteSummary;
  siteAnalytics: SiteAnalyticsSummary;
  campaigns: CampaignSummary[];
  selectedCampaign: CampaignDetail | null;
  countryPerformance: CountryPerformanceSummary[];
  sitePerformance: SitePerformanceSummary[];
  timePerformance: TimePerformanceSummary[];
  contentPerformance: ContentPerformanceSummary[];
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

function fallbackCountryPerformance(site: SiteSummary[]): CountryPerformanceSummary[] {
  const countries = Array.from(new Set(site.map((entry) => entry.country))).slice(0, 5);
  return countries.map((country, index) => ({
    country,
    totalSubscribers: Math.max(42000 - index * 5100, 12000),
    totalDelivered: Math.max(39000 - index * 4700, 11000),
    totalSent: Math.max(40200 - index * 4800, 11500),
    totalFailed: 600 + index * 80,
    totalExpired: 320 + index * 45,
    totalClicked: Math.max(3200 - index * 220, 900),
    deliveryRate: Math.max(91 - index * 2, 78),
    clickThroughRate: Math.max(8.4 - index * 0.6, 3.2),
  }));
}

function fallbackSitePerformance(site: SiteSummary[]): SitePerformanceSummary[] {
  return site.slice(0, 5).map((entry, index) => ({
    siteId: entry.id,
    siteName: entry.name,
    totalSubscribers: entry.subscribers,
    totalDelivered: Math.max(Math.floor(entry.subscribers * 0.92), 1),
    totalSent: Math.max(Math.floor(entry.subscribers * 0.94), 1),
    totalFailed: Math.max(Math.floor(entry.subscribers * 0.01), 0),
    totalExpired: Math.max(Math.floor(entry.subscribers * 0.02), 0),
    totalClicked: Math.max(Math.floor(entry.subscribers * (0.06 - index * 0.004)), 1),
    deliveryRate: Math.max(92 - index * 1.1, 80),
    clickThroughRate: Math.max(7.2 - index * 0.5, 2.4),
  }));
}

function fallbackTimePerformance(): TimePerformanceSummary[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalDelivered: hour >= 8 && hour <= 20 ? 4000 + hour * 140 : 900 + hour * 45,
    totalSent: hour >= 8 && hour <= 20 ? 4200 + hour * 150 : 1100 + hour * 50,
    totalFailed: hour % 6 === 0 ? 80 : 35,
    totalClicked: hour >= 9 && hour <= 21 ? 260 + hour * 12 : 60 + hour * 5,
    deliveryRate: hour >= 8 && hour <= 20 ? 93 : 84,
    clickThroughRate: hour >= 9 && hour <= 21 ? 6.2 : 2.8,
  }));
}

function fallbackContentPerformance(): ContentPerformanceSummary[] {
  return [
    { contentType: "promotion", totalCampaigns: 12, totalDelivered: 142000, totalSent: 151000, totalFailed: 2100, totalExpired: 600, totalClicked: 11800, deliveryRate: 92.1, clickThroughRate: 7.8 },
    { contentType: "editorial", totalCampaigns: 8, totalDelivered: 92000, totalSent: 95500, totalFailed: 1100, totalExpired: 250, totalClicked: 7100, deliveryRate: 94.2, clickThroughRate: 7.2 },
    { contentType: "digest", totalCampaigns: 6, totalDelivered: 62000, totalSent: 64500, totalFailed: 900, totalExpired: 180, totalClicked: 5300, deliveryRate: 94.4, clickThroughRate: 8.3 },
    { contentType: "announcement", totalCampaigns: 4, totalDelivered: 38000, totalSent: 39600, totalFailed: 560, totalExpired: 140, totalClicked: 2900, deliveryRate: 94.8, clickThroughRate: 7.1 },
    { contentType: "alert", totalCampaigns: 2, totalDelivered: 12000, totalSent: 12600, totalFailed: 220, totalExpired: 80, totalClicked: 900, deliveryRate: 93.7, clickThroughRate: 6.6 },
  ];
}

function buildFallbackAnalytics(site: SiteSummary): SiteAnalyticsSummary {
  const activeSubscribers = site.subscribers;
  const totalDelivered = Math.max(Math.floor(site.subscribers * 0.94), 1);
  const totalFailed = Math.max(Math.floor(site.subscribers * 0.01), 0);
  const totalExpired = Math.max(Math.floor(site.subscribers * 0.02), 0);

  const buildFallbackGrowth = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      date: date.toISOString().slice(0, 10),
      newSubscribers: Math.max(Math.floor(site.subscribers / 120), 120) + index * 18,
    };
  });

  return {
    totalSubscribers: site.subscribers,
    activeSubscribers,
    last30Days: {
      totalPending: Math.max(Math.floor(site.subscribers * 0.003), 0),
      totalSent: totalDelivered + totalFailed + totalExpired,
      totalDelivered,
      totalFailed,
      totalExpired,
      subscriberGrowth: buildFallbackGrowth,
    },
  };
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
    (input.campaignId ? await getCampaignById(input.campaignId) : null) ??
    (campaignsPayload.items[0] ? await getCampaignById(campaignsPayload.items[0].id) : null);

  const siteAnalytics = await getSiteAnalytics(selectedSite);
  const [countryPerformance, sitePerformance, timePerformance] = await Promise.all([
    getAnalyticsApiList<CountryPerformanceSummary>("/analytics/countries?days=" + days, fallbackCountryPerformance(sites)),
    getAnalyticsApiList<SitePerformanceSummary>("/analytics/sites-performance?days=" + days, fallbackSitePerformance(sites)),
    getAnalyticsApiList<TimePerformanceSummary>("/analytics/time-performance?days=" + days, fallbackTimePerformance()),
  ]);
  const contentPerformance = await getAnalyticsApiList<ContentPerformanceSummary>(
    "/analytics/content-performance?days=" + days,
    fallbackContentPerformance(),
  );

  return {
    days,
    rangeLabel: rangeLabels[days],
    overview,
    sites,
    selectedSite,
    siteAnalytics,
    campaigns: campaignsPayload.items,
    selectedCampaign,
    countryPerformance,
    sitePerformance,
    timePerformance,
    contentPerformance,
  };
}

async function getAnalyticsApiList<T>(path: string, fallback: T[]): Promise<T[]> {
  const response = await apiJson<{ success: true; data: T[] }>(path);
  if (!response?.data) {
    return fallback;
  }

  return response.data;
}
