import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import { formatTimeBucketLabel, getTimePerformancePage, normalizeDays } from "../../_data/analytics";
import { getSiteChoices } from "../../_data/sites";
import { AnalyticsDaysFilter } from "../analytics-days-filter";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function TimePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; siteId?: string }>;
}) {
  const query = await searchParams;
  const days = normalizeDays(query.days);
  const [timePerformance, sites] = await Promise.all([
    getTimePerformancePage(days, query.siteId),
    getSiteChoices(),
  ]);
  const realSites = sites.filter((site) => site.id !== "site-3");

  const currentParams = { days: String(days), siteId: query.siteId };

  const section: ExplorerSection = {
    key: "time",
    label: "Time",
    eyebrow: "Time performance",
    title: days <= 1 ? "Delivery volume by hour" : "Delivery volume over time",
    badge: "UTC",
    metrics: [
      { key: "delivered", label: "Delivered", color: "#ea580c", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, days), value: item.totalDelivered })) },
      { key: "sent", label: "Sent", color: "#0ea5e9", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, days), value: item.totalSent })) },
      { key: "failed", label: "Failed", color: "#dc2626", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, days), value: item.totalFailed })) },
      { key: "clicked", label: "Clicked", color: "#16a34a", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, days), value: item.totalClicked })) },
      { key: "delivery-rate", label: "Delivery rate", color: "#16a34a", format: "percent", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, days), value: item.deliveryRate })) },
      { key: "ctr", label: "CTR", color: "#0ea5e9", format: "percent", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, days), value: item.clickThroughRate })) },
    ],
    rowColumns: [days <= 1 ? "Hour" : "Date", "Sent", "Delivered", "CTR"],
    rows: timePerformance.map((item) => ({
      primary: formatTimeBucketLabel(item.bucket, days),
      secondary: `${item.totalFailed} failed`,
      metrics: [
        { label: "Sent", value: formatNumber(item.totalSent) },
        { label: "Delivered", value: formatNumber(item.totalDelivered) },
        { label: "CTR", value: formatPercent(item.clickThroughRate) },
      ],
    })),
  };

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Time performance"
      description="Delivery volume by hour (single-day ranges) or by day, in UTC."
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
            <AnalyticsDaysFilter basePath="/analytics/time" currentParams={currentParams} days={days} />
            <FilterSelect
              basePath="/analytics/time"
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
