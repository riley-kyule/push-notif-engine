import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import {
  formatHourOfDayLabel,
  formatHourOfDayLabelInZone,
  formatTimeBucketLabel,
  getPeakHoursPage,
  getTimePerformancePage,
  resolveAnalyticsRange,
  type PeakHourSummary,
  type TimePerformanceSummary,
} from "../../_data/analytics";
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

function topHoursBySubscribers(peakHours: PeakHourSummary[], count: number): PeakHourSummary[] {
  return [...peakHours].sort((a, b) => b.newSubscribers - a.newSubscribers).slice(0, count);
}

function topHoursByCtr(peakHours: PeakHourSummary[], count: number): PeakHourSummary[] {
  return [...peakHours]
    .filter((entry) => entry.totalSent + entry.totalDelivered > 0)
    .sort((a, b) => b.clickThroughRate - a.clickThroughRate)
    .slice(0, count);
}

function aggregate(rows: TimePerformanceSummary[]) {
  const totalSent = rows.reduce((sum, row) => sum + row.totalSent, 0);
  const totalDelivered = rows.reduce((sum, row) => sum + row.totalDelivered, 0);
  const totalClicked = rows.reduce((sum, row) => sum + row.totalClicked, 0);
  const successfullyHandedOff = totalSent + totalDelivered;
  return {
    totalSent,
    totalDelivered,
    clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
  };
}

export default async function TimePerformancePage({
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

  const [timePerformance, comparisonTimePerformance, peakHours, sites] = await Promise.all([
    getTimePerformancePage(range, query.siteId),
    comparisonRange ? getTimePerformancePage(comparisonRange, query.siteId) : Promise.resolve(null),
    getPeakHoursPage(range, query.siteId),
    getSiteChoices(),
  ]);
  const realSites = sites.filter((site) => site.id !== "site-3");
  const selectedSite = query.siteId ? realSites.find((site) => site.id === query.siteId) ?? null : null;

  const bestSubscriptionHours = topHoursBySubscribers(peakHours, 3);
  const bestCtrHours = topHoursByCtr(peakHours, 3);

  function renderHourLabel(hour: number) {
    if (!selectedSite?.timezone) {
      return formatHourOfDayLabel(hour);
    }
    const localLabel = formatHourOfDayLabelInZone(hour, selectedSite.timezone);
    return (
      <>
        {formatHourOfDayLabel(hour)} <span className="subtle">(UTC+3)</span> · {localLabel}{" "}
        <span className="subtle">({selectedSite.name} local)</span>
      </>
    );
  }

  const section: ExplorerSection = {
    key: "time",
    label: "Time",
    eyebrow: "Time performance",
    title: range.days <= 1 ? "Delivery volume by hour" : "Delivery volume over time",
    badge: "UTC",
    metrics: [
      { key: "delivered", label: "Delivered", color: "#ea580c", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, range.days), value: item.totalDelivered })) },
      { key: "sent", label: "Sent", color: "#0ea5e9", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, range.days), value: item.totalSent })) },
      { key: "failed", label: "Failed", color: "#dc2626", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, range.days), value: item.totalFailed })) },
      { key: "clicked", label: "Clicked", color: "#16a34a", format: "number", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, range.days), value: item.totalClicked })) },
      { key: "delivery-rate", label: "Delivery rate", color: "#16a34a", format: "percent", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, range.days), value: item.deliveryRate })) },
      { key: "ctr", label: "CTR", color: "#0ea5e9", format: "percent", points: timePerformance.map((item) => ({ label: formatTimeBucketLabel(item.bucket, range.days), value: item.clickThroughRate })) },
    ],
    rowColumns: [range.days <= 1 ? "Hour" : "Date", "Sent", "Delivered", "CTR"],
    rows: timePerformance.map((item) => ({
      primary: formatTimeBucketLabel(item.bucket, range.days),
      secondary: `${item.totalFailed} failed`,
      metrics: [
        { label: "Sent", value: formatNumber(item.totalSent) },
        { label: "Delivered", value: formatNumber(item.totalDelivered) },
        { label: "CTR", value: formatPercent(item.clickThroughRate) },
      ],
    })),
  };

  const currentTotals = aggregate(timePerformance);
  const comparisonTotals = comparisonTimePerformance ? aggregate(comparisonTimePerformance) : null;

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
      <section className="card analytics-panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Reporting window</p>
            <h3>{range.label}</h3>
          </div>
          <FilterSelect
            basePath="/analytics/time"
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
              { label: "Sent", current: formatNumber(currentTotals.totalSent), comparison: formatNumber(comparisonTotals.totalSent) },
              { label: "Delivered", current: formatNumber(currentTotals.totalDelivered), comparison: formatNumber(comparisonTotals.totalDelivered) },
              { label: "CTR", current: formatPercent(currentTotals.clickThroughRate), comparison: formatPercent(comparisonTotals.clickThroughRate) },
            ]}
          />
        </div>
      ) : null}

      <section className="card analytics-panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Best times to send</p>
            <h3>
              High-activity hours over the last {range.days === 1 ? "day" : `${range.days} days`}
              {selectedSite ? ` for ${selectedSite.name}` : " — averaged across all sites"}
            </h3>
          </div>
        </div>
        <div className="grid cards-2">
          <article className="card" style={{ boxShadow: "none", background: "var(--surface-raised)" }}>
            <h4 style={{ marginTop: 0 }}>Most new subscriptions</h4>
            {bestSubscriptionHours.every((entry) => entry.newSubscribers === 0) ? (
              <p className="subtle">No subscriptions recorded in this window yet.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {bestSubscriptionHours.map((entry) => (
                  <li key={entry.hour}>
                    <strong>{renderHourLabel(entry.hour)}</strong> — {formatNumber(entry.newSubscribers)} new subscribers
                    {selectedSite ? "" : " (average per site)"}
                  </li>
                ))}
              </ol>
            )}
          </article>
          <article className="card" style={{ boxShadow: "none", background: "var(--surface-raised)" }}>
            <h4 style={{ marginTop: 0 }}>Highest click-through rate</h4>
            {bestCtrHours.length === 0 ? (
              <p className="subtle">No delivered pushes recorded in this window yet.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {bestCtrHours.map((entry) => (
                  <li key={entry.hour}>
                    <strong>{renderHourLabel(entry.hour)}</strong> — {formatPercent(entry.clickThroughRate)} CTR
                  </li>
                ))}
              </ol>
            )}
          </article>
        </div>
        <p className="subtle" style={{ marginTop: 12, marginBottom: 0 }}>
          {selectedSite
            ? `Hour-of-day pattern across the whole range, shown in UTC+3 and in ${selectedSite.name}'s own local time — schedule this site's campaigns and automations around these windows.`
            : "Hour-of-day pattern across the whole range, in UTC+3, averaged evenly across every site so no single large site dominates the pattern. Pick a site above for its own local-time breakdown."}
        </p>
      </section>

      <AnalyticsPerformanceExplorer sections={[section]} />
    </DashboardShell>
  );
}
