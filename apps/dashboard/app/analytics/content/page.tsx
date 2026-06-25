import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import { getContentPerformancePage, resolveAnalyticsRange, type ContentPerformanceSummary } from "../../_data/analytics";
import { getSiteChoices } from "../../_data/sites";
import { AnalyticsComparisonCard } from "../analytics-comparison-card";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";
import { AnalyticsRangePicker } from "../analytics-range-picker";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function aggregate(rows: ContentPerformanceSummary[]) {
  const totalCampaigns = rows.reduce((sum, row) => sum + row.totalCampaigns, 0);
  const totalDelivered = rows.reduce((sum, row) => sum + row.totalDelivered, 0);
  const totalSent = rows.reduce((sum, row) => sum + row.totalSent, 0);
  const totalClicked = rows.reduce((sum, row) => sum + row.totalClicked, 0);
  const successfullyHandedOff = totalSent + totalDelivered;
  return {
    totalCampaigns,
    totalDelivered,
    clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
  };
}

export default async function ContentPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    siteId?: string;
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

  const [contentPerformance, comparisonContentPerformance, sites] = await Promise.all([
    getContentPerformancePage(range, query.siteId),
    comparisonRange ? getContentPerformancePage(comparisonRange, query.siteId) : Promise.resolve(null),
    getSiteChoices(),
  ]);
  const realSites = sites.filter((site) => site.id !== "site-3");

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

  const currentTotals = aggregate(contentPerformance);
  const comparisonTotals = comparisonContentPerformance ? aggregate(comparisonContentPerformance) : null;

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
      <section className="card analytics-panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Reporting window</p>
            <h3>{range.label}</h3>
          </div>
          <FilterSelect
            basePath="/analytics/content"
            currentParams={{ days: String(range.days), siteId: query.siteId }}
            paramKey="siteId"
            allLabel="All sites"
            options={realSites.map((site) => ({ value: site.id, label: site.name }))}
          />
        </div>
        <AnalyticsRangePicker
          selectedPreset={selectedPreset}
          compareMode={compareMode}
          range={range}
          comparisonRange={comparisonRange}
          siteId={query.siteId ?? ""}
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
              { label: "Campaigns", current: formatNumber(currentTotals.totalCampaigns), comparison: formatNumber(comparisonTotals.totalCampaigns) },
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
