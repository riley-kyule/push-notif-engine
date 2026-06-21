import type { DashboardOverview } from "./overview";
import type { CampaignSummary } from "./campaigns";
import type { SitePerformanceSummary } from "./analytics";

export type OverviewCard = {
  label: string;
  value: string;
  detail: string;
  href: string;
};

export type RankingItem = {
  label: string;
  detail: string;
  href: string;
};

export type RankingCard = {
  eyebrow: string;
  title: string;
  highestLabel: string;
  lowestLabel: string;
  highestItems: RankingItem[];
  lowestItems: RankingItem[];
};

function buildAnalyticsHref(params: { section: string; siteId?: string; campaignId?: string }): string {
  const search = new URLSearchParams({
    section: params.section,
    days: "30",
    preset: "30d",
  });
  if (params.siteId) {
    search.set("siteId", params.siteId);
  }
  if (params.campaignId) {
    search.set("campaignId", params.campaignId);
  }
  return `/analytics?${search.toString()}`;
}

export function buildOverviewCards(overview: DashboardOverview): OverviewCard[] {
  return [
    {
      label: "Total subscribers",
      value: overview.totalSubscribers.toLocaleString(),
      detail: `Across ${overview.totalSites} site${overview.totalSites === 1 ? "" : "s"}`,
      href: buildAnalyticsHref({ section: "site", siteId: "site-3" }),
    },
    {
      label: "Active campaigns",
      value: String(overview.activeCampaigns),
      detail: `${overview.totalCampaigns} total campaigns`,
      href: buildAnalyticsHref({ section: "content" }),
    },
    {
      label: "30-day CTR",
      value: `${overview.clickThroughRate}%`,
      detail: `${overview.totalClicked.toLocaleString()} clicks tracked`,
      href: buildAnalyticsHref({ section: "content", siteId: "site-3" }),
    },
    {
      label: "Delivery rate",
      value: `${overview.deliveryRate}%`,
      detail: "Queue-backed browser and mobile delivery",
      href: buildAnalyticsHref({ section: "time", siteId: "site-3" }),
    },
    {
      label: "Pending deliveries",
      value: String(overview.totalPending),
      detail: "Queued for dispatch",
      href: buildAnalyticsHref({ section: "time", siteId: "site-3" }),
    },
    {
      label: "Failed deliveries",
      value: String(overview.totalFailed),
      detail: "Needs review in delivery reporting",
      href: buildAnalyticsHref({ section: "time", siteId: "site-3" }),
    },
  ];
}

function parsePercent(value: string): number {
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

type RankedItem = RankingItem & { score: number };

function sortTop(items: RankedItem[]) {
  return [...items].sort((left, right) => right.score - left.score);
}

function sortBottom(items: RankedItem[]) {
  return [...items].sort((left, right) => left.score - right.score);
}

export function buildPerformanceRankingCards({
  sites,
  campaigns,
}: {
  sites: SitePerformanceSummary[];
  campaigns: CampaignSummary[];
}): RankingCard[] {
  const rankableSites = sites.filter((site) => site.siteName.toLowerCase() !== "all sites");
  const siteScores: RankedItem[] = rankableSites.map((site) => ({
    score: site.totalSubscribers,
    label: site.siteName,
    detail: `${site.totalSubscribers.toLocaleString()} subscribers`,
    href: buildAnalyticsHref({ section: "site", siteId: site.siteId }),
  }));

  const campaignScores: RankedItem[] = campaigns.map((campaign) => ({
    score: parsePercent(campaign.ctr),
    label: campaign.name,
    detail: `${campaign.ctr} CTR · ${campaign.site}`,
    href: buildAnalyticsHref({ section: "content", campaignId: campaign.id }),
  }));

  return [
    {
      eyebrow: "Site rankings",
      title: "Highest and lowest subscribed sites",
      highestLabel: "Highest subscribed",
      lowestLabel: "Lowest subscribed",
      highestItems: sortTop(siteScores).slice(0, 3).map(({ label, detail, href }) => ({ label, detail, href })),
      lowestItems: sortBottom(siteScores).slice(0, 3).map(({ label, detail, href }) => ({ label, detail, href })),
    },
    {
      eyebrow: "Campaign rankings",
      title: "Highest and lowest converting campaigns",
      highestLabel: "Highest converting",
      lowestLabel: "Lowest converting",
      highestItems: sortTop(campaignScores).slice(0, 3).map(({ label, detail, href }) => ({ label, detail, href })),
      lowestItems: sortBottom(campaignScores).slice(0, 3).map(({ label, detail, href }) => ({ label, detail, href })),
    },
  ];
}
