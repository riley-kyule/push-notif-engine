import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import {
  formatHourOfDayLabel,
  formatHourOfDayLabelInZone,
  formatTimeBucketLabel,
  getPeakHoursPage,
  getTimePerformancePage,
  normalizeDays,
  type PeakHourSummary,
} from "../../_data/analytics";
import { getSiteChoices } from "../../_data/sites";
import { AnalyticsDaysFilter } from "../analytics-days-filter";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";

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

export default async function TimePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; siteId?: string }>;
}) {
  const query = await searchParams;
  const days = normalizeDays(query.days);
  const [timePerformance, peakHours, sites] = await Promise.all([
    getTimePerformancePage(days, query.siteId),
    getPeakHoursPage(days, query.siteId),
    getSiteChoices(),
  ]);
  const realSites = sites.filter((site) => site.id !== "site-3");
  const selectedSite = query.siteId ? realSites.find((site) => site.id === query.siteId) ?? null : null;

  const currentParams = { days: String(days), siteId: query.siteId };
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
      <section className="card analytics-panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Best times to send</p>
            <h3>
              High-activity hours over the last {days === 1 ? "day" : `${days} days`}
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
