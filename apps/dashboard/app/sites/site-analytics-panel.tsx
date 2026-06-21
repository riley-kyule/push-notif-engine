import type { SiteSummary } from "./sites.utils";
import type { SiteAnalyticsSummary } from "../../lib/site-analytics";
import { LineChart } from "../_components/charts/line-chart";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function SiteAnalyticsPanel({
  site,
  analytics,
}: {
  site: SiteSummary;
  analytics: SiteAnalyticsSummary;
}) {
  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <strong>Subscriber Growth</strong>
        <span className="subtle">WebPushr re-acquisition signal for {site.name}</span>
      </div>

      <div className="grid cards-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="subtle">Total subscribers</p>
          <p className="stat">{formatNumber(analytics.totalSubscribers)}</p>
        </article>
        <article className="card">
          <p className="subtle">Active subscribers</p>
          <p className="stat">{formatNumber(analytics.activeSubscribers)}</p>
        </article>
        <article className="card">
          <p className="subtle">Delivered 30d</p>
          <p className="stat">{formatNumber(analytics.last30Days.totalDelivered)}</p>
        </article>
        <article className="card">
          <p className="subtle">Expired 30d</p>
          <p className="stat">{formatNumber(analytics.last30Days.totalExpired)}</p>
        </article>
      </div>

      <div style={{ marginTop: 18 }}>
        <LineChart
          points={analytics.last30Days.subscriberGrowth.map((item) => ({ label: item.date, value: item.newSubscribers }))}
          formatValue={formatNumber}
        />
      </div>

      <div className="grid cards-3" style={{ marginTop: 18 }}>
        <article className="card">
          <p className="subtle">Pending</p>
          <p className="stat">{formatNumber(analytics.last30Days.totalPending)}</p>
        </article>
        <article className="card">
          <p className="subtle">Sent</p>
          <p className="stat">{formatNumber(analytics.last30Days.totalSent)}</p>
        </article>
        <article className="card">
          <p className="subtle">Failed</p>
          <p className="stat">{formatNumber(analytics.last30Days.totalFailed)}</p>
        </article>
      </div>
    </section>
  );
}
