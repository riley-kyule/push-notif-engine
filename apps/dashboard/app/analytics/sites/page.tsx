import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { getSitePerformancePage, resolveAnalyticsRange, type SitePerformanceSummary } from "../../_data/analytics";
import { AnalyticsComparisonCard } from "../analytics-comparison-card";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";
import { AnalyticsRangePicker } from "../analytics-range-picker";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function aggregate(rows: SitePerformanceSummary[]) {
  const totalSubscribers = rows.reduce((sum, row) => sum + row.totalSubscribers, 0);
  const totalDelivered = rows.reduce((sum, row) => sum + row.totalDelivered, 0);
  const totalSent = rows.reduce((sum, row) => sum + row.totalSent, 0);
  const totalClicked = rows.reduce((sum, row) => sum + row.totalClicked, 0);
  const successfullyHandedOff = totalSent + totalDelivered;
  return {
    totalSubscribers,
    totalDelivered,
    clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
  };
}

export default async function SitePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    preset?: string;
    startDate?: string;
    endDate?: string;
    compareMode?: string;
    compareStartDate?: string;
    compareEndDate?: string;
  }>;
}) {
  const query = await searchParams;
  const { selectedPreset, range, compareMode, comparisonRange } = resolveAnalyticsRange(query);

  const [sitePerformance, comparisonSitePerformance] = await Promise.all([
    getSitePerformancePage(range),
    comparisonRange ? getSitePerformancePage(comparisonRange) : Promise.resolve(null),
  ]);

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

  const currentTotals = aggregate(sitePerformance);
  const comparisonTotals = comparisonSitePerformance ? aggregate(comparisonSitePerformance) : null;

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
      <section className="card analytics-panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Reporting window</p>
            <h3>{range.label}</h3>
          </div>
        </div>
        <AnalyticsRangePicker
          selectedPreset={selectedPreset}
          compareMode={compareMode}
          range={range}
          comparisonRange={comparisonRange}
          siteId=""
          campaignId={null}
          compact
        />
      </section>

      {comparisonTotals ? (
        <div style={{ marginBottom: 18 }}>
          <AnalyticsComparisonCard
            currentLabel={range.label}
            comparisonLabel={comparisonRange?.label ?? "Comparison period"}
            metrics={[
              { label: "Subscribers", current: formatNumber(currentTotals.totalSubscribers), comparison: formatNumber(comparisonTotals.totalSubscribers) },
              { label: "Delivered", current: formatNumber(currentTotals.totalDelivered), comparison: formatNumber(comparisonTotals.totalDelivered) },
              { label: "CTR", current: formatPercent(currentTotals.clickThroughRate), comparison: formatPercent(comparisonTotals.clickThroughRate) },
            ]}
          />
        </div>
      ) : null}

      <AnalyticsPerformanceExplorer sections={[section]} />
    </DashboardShell>
  );
}
