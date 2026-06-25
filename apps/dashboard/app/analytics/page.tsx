import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { formatTimeBucketLabel, getAnalyticsDashboardData } from "../_data/analytics";
import { AnalyticsRangePicker } from "./analytics-range-picker";
import { buildAnalyticsOverviewCards } from "./analytics-overview";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "./analytics-performance-explorer";

function buildQuery(params: {
  preset: string;
  days: number;
  startDate?: string;
  endDate?: string;
  compareMode?: string;
  compareStartDate?: string;
  compareEndDate?: string;
}): string {
  const search = new URLSearchParams();
  search.set("preset", params.preset);
  search.set("days", String(params.days));
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  if (params.compareMode) search.set("compareMode", params.compareMode);
  if (params.compareStartDate) search.set("compareStartDate", params.compareStartDate);
  if (params.compareEndDate) search.set("compareEndDate", params.compareEndDate);
  return `/analytics?${search.toString()}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

const REPORT_LINKS = [
  { href: "/analytics/sites", label: "Sites", description: "Compare delivery, subscribers, and CTR across every site." },
  { href: "/analytics/countries", label: "Countries", description: "Performance grouped by subscriber country." },
  { href: "/analytics/content", label: "Content", description: "Performance grouped by content category." },
  { href: "/analytics/time", label: "Time", description: "Delivery volume by hour or by day, in UTC." },
  { href: "/analytics/failures", label: "Failures", description: "Every failed delivery, filterable by site, push, and reason." },
  { href: "/analytics/campaigns", label: "Campaigns", description: "Drill into one campaign's sent, delivered, and CTR figures." },
] as const;

export default async function AnalyticsPage({
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
  // The overview is always the cross-site total -- per-site drilldown now
  // lives on /analytics/sites, so this never passes a siteId through.
  const dashboard = await getAnalyticsDashboardData(query);
  const overviewCards = buildAnalyticsOverviewCards(dashboard.overview, { failureHref: "/analytics/failures" });

  const trendSection: ExplorerSection = {
    key: "overview-trend",
    label: "Trend",
    eyebrow: "Delivery trend",
    title: dashboard.days <= 1 ? "Delivery volume by hour" : "Delivery volume over the selected range",
    badge: "UTC",
    metrics: [
      {
        key: "delivered",
        label: "Delivered",
        color: "#ea580c",
        format: "number",
        points: dashboard.timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, dashboard.days), value: item.totalDelivered })),
      },
      {
        key: "sent",
        label: "Sent",
        color: "#0ea5e9",
        format: "number",
        points: dashboard.timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, dashboard.days), value: item.totalSent })),
      },
      {
        key: "clicked",
        label: "Clicked",
        color: "#16a34a",
        format: "number",
        points: dashboard.timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, dashboard.days), value: item.totalClicked })),
      },
      {
        key: "ctr",
        label: "CTR",
        color: "#0ea5e9",
        format: "percent",
        points: dashboard.timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, dashboard.days), value: item.clickThroughRate })),
      },
    ],
  };

  const currentFilters = {
    preset: dashboard.selectedPreset,
    days: dashboard.days,
    ...(dashboard.selectedPreset === "custom" && dashboard.range.days > 1 ? { endDate: dashboard.range.endDate } : {}),
    ...(dashboard.selectedPreset === "custom" ? { startDate: dashboard.range.startDate } : {}),
    compareMode: dashboard.compareMode,
    ...(dashboard.compareMode === "custom" && dashboard.comparisonRange
      ? { compareStartDate: dashboard.comparisonRange.startDate, compareEndDate: dashboard.comparisonRange.endDate }
      : {}),
  };

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Analytics overview"
      description="The at-a-glance summary, with every detailed report one click away."
      actions={
        <>
          <Link className="button secondary" href="/campaigns/new">
            New campaign
          </Link>
          <Link className="button primary" href={buildQuery(currentFilters)}>
            Refresh data
          </Link>
        </>
      }
    >
      <div className="analytics-page">
        <section className="analytics-summary-grid">
          {overviewCards.map((item) =>
            item.href ? (
              <Link key={item.label} className="card analytics-summary-card overview-summary-link" href={item.href} aria-label={`${item.label}: ${item.value}`}>
                <p className="analytics-summary-label">{item.label}</p>
                <p className="analytics-summary-value">{item.value}</p>
                <p className="analytics-summary-detail">{item.detail}</p>
                <span className="overview-summary-cta">View details →</span>
              </Link>
            ) : (
              <article key={item.label} className="card analytics-summary-card">
                <p className="analytics-summary-label">{item.label}</p>
                <p className="analytics-summary-value">{item.value}</p>
                <p className="analytics-summary-detail">{item.detail}</p>
              </article>
            ),
          )}
        </section>

        <section className="card analytics-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Reporting window</p>
              <h3>{dashboard.rangeLabel}</h3>
            </div>
          </div>
          <AnalyticsRangePicker
            selectedPreset={dashboard.selectedPreset}
            compareMode={dashboard.compareMode}
            range={dashboard.range}
            comparisonRange={dashboard.comparisonRange}
            siteId={dashboard.selectedSite.id}
            campaignId={null}
          />
        </section>

        <AnalyticsPerformanceExplorer sections={[trendSection]} />

        {dashboard.comparisonOverview && dashboard.comparisonRange ? (
          <section className="card analytics-comparison-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Range comparison</p>
                <h3>
                  {dashboard.rangeLabel} vs {dashboard.comparisonRange.label}
                </h3>
              </div>
              <span className="badge active">Side by side</span>
            </div>

            <div className="analytics-comparison-grid">
              <article className="analytics-comparison-block">
                <p className="subtle">Selected range</p>
                <strong>{dashboard.rangeLabel}</strong>
                <dl className="analytics-comparison-metrics">
                  <div>
                    <dt>Subscribers</dt>
                    <dd>{formatNumber(dashboard.overview.totalSubscribers)}</dd>
                  </div>
                  <div>
                    <dt>Delivered</dt>
                    <dd>{formatNumber(dashboard.overview.totalDelivered)}</dd>
                  </div>
                  <div>
                    <dt>Clicks</dt>
                    <dd>{formatNumber(dashboard.overview.totalClicked)}</dd>
                  </div>
                  <div>
                    <dt>CTR</dt>
                    <dd>{formatPercent(dashboard.overview.clickThroughRate)}</dd>
                  </div>
                </dl>
              </article>
              <article className="analytics-comparison-block">
                <p className="subtle">Comparison range</p>
                <strong>{dashboard.comparisonRange.label}</strong>
                <dl className="analytics-comparison-metrics">
                  <div>
                    <dt>Subscribers</dt>
                    <dd>{formatNumber(dashboard.comparisonOverview.totalSubscribers)}</dd>
                  </div>
                  <div>
                    <dt>Delivered</dt>
                    <dd>{formatNumber(dashboard.comparisonOverview.totalDelivered)}</dd>
                  </div>
                  <div>
                    <dt>Clicks</dt>
                    <dd>{formatNumber(dashboard.comparisonOverview.totalClicked)}</dd>
                  </div>
                  <div>
                    <dt>CTR</dt>
                    <dd>{formatPercent(dashboard.comparisonOverview.clickThroughRate)}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>
        ) : null}

        <section className="card analytics-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Reports</p>
              <h3>Jump into a detailed report</h3>
            </div>
          </div>
          <div className="grid cards-3">
            {REPORT_LINKS.map((report) => (
              <Link key={report.href} href={report.href} className="card analytics-summary-card overview-summary-link" style={{ margin: 0 }}>
                <p className="analytics-summary-label">{report.label}</p>
                <p className="analytics-summary-detail">{report.description}</p>
                <span className="overview-summary-cta">Open →</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
