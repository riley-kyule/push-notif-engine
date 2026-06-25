import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { getSitePerformancePage, normalizeDays } from "../../_data/analytics";
import { AnalyticsDaysFilter } from "../analytics-days-filter";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function SitePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const query = await searchParams;
  const days = normalizeDays(query.days);
  const sitePerformance = await getSitePerformancePage(days);

  const currentParams = { days: String(days) };

  const section: ExplorerSection = {
    key: "site",
    label: "Sites",
    eyebrow: "Site performance",
    title: "Compare delivery across every site",
    badge: "Live",
    metrics: [
      { key: "subscribers", label: "Subscribers", color: "#ea580c", format: "number", points: sitePerformance.map((item) => ({ label: item.siteName, value: item.totalSubscribers })) },
      { key: "delivery", label: "Delivery rate", color: "#16a34a", format: "percent", points: sitePerformance.map((item) => ({ label: item.siteName, value: item.deliveryRate })) },
      { key: "ctr", label: "CTR", color: "#0ea5e9", format: "percent", points: sitePerformance.map((item) => ({ label: item.siteName, value: item.clickThroughRate })) },
    ],
    rowColumns: ["Site", "Subscribers", "Delivery rate", "CTR"],
    rows: sitePerformance.map((item) => ({
      primary: item.siteName,
      secondary: item.siteId,
      metrics: [
        { label: "Subscribers", value: formatNumber(item.totalSubscribers) },
        { label: "Delivery rate", value: formatPercent(item.deliveryRate) },
        { label: "CTR", value: formatPercent(item.clickThroughRate) },
      ],
    })),
  };

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Site performance"
      description="Compare subscriber counts, delivery rate, and CTR across every site."
      actions={
        <Link className="button secondary" href="/analytics">
          Back to analytics
        </Link>
      }
    >
      <AnalyticsPerformanceExplorer sections={[section]} controls={<AnalyticsDaysFilter basePath="/analytics/sites" currentParams={currentParams} days={days} />} />
    </DashboardShell>
  );
}
