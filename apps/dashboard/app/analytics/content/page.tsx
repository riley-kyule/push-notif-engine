import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import { getContentPerformancePage, normalizeDays } from "../../_data/analytics";
import { getSiteChoices } from "../../_data/sites";
import { AnalyticsDaysFilter } from "../analytics-days-filter";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function ContentPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; siteId?: string }>;
}) {
  const query = await searchParams;
  const days = normalizeDays(query.days);
  const [contentPerformance, sites] = await Promise.all([
    getContentPerformancePage(days, query.siteId),
    getSiteChoices(),
  ]);
  const realSites = sites.filter((site) => site.id !== "site-3");

  const currentParams = { days: String(days), siteId: query.siteId };

  const section: ExplorerSection = {
    key: "content",
    label: "Content",
    eyebrow: "Content performance",
    title: "Performance by content category",
    badge: "Campaign types",
    metrics: [
      { key: "campaigns", label: "Campaigns", color: "#ea580c", format: "number", points: contentPerformance.map((item) => ({ label: item.contentType, value: item.totalCampaigns })) },
      { key: "delivered", label: "Delivered", color: "#0ea5e9", format: "number", points: contentPerformance.map((item) => ({ label: item.contentType, value: item.totalDelivered })) },
      { key: "delivery", label: "Delivery rate", color: "#16a34a", format: "percent", points: contentPerformance.map((item) => ({ label: item.contentType, value: item.deliveryRate })) },
      { key: "ctr", label: "CTR", color: "#0ea5e9", format: "percent", points: contentPerformance.map((item) => ({ label: item.contentType, value: item.clickThroughRate })) },
    ],
    rowColumns: ["Type", "Campaigns", "Delivery rate", "CTR"],
    rows: contentPerformance.map((item) => ({
      primary: item.contentType,
      secondary: `${formatNumber(item.totalCampaigns)} campaigns`,
      metrics: [
        { label: "Campaigns", value: formatNumber(item.totalCampaigns) },
        { label: "Delivery rate", value: formatPercent(item.deliveryRate) },
        { label: "CTR", value: formatPercent(item.clickThroughRate) },
      ],
    })),
  };

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Content performance"
      description="Delivery and engagement grouped by controlled content category."
      actions={
        <Link className="button secondary" href="/analytics">
          Back to analytics
        </Link>
      }
    >
      <AnalyticsPerformanceExplorer
        sections={[section]}
        controls={
          <>
            <AnalyticsDaysFilter basePath="/analytics/content" currentParams={currentParams} days={days} />
            <FilterSelect
              basePath="/analytics/content"
              currentParams={currentParams}
              paramKey="siteId"
              allLabel="All sites"
              options={realSites.map((site) => ({ value: site.id, label: site.name }))}
            />
          </>
        }
      />
    </DashboardShell>
  );
}
