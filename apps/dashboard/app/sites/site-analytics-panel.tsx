import type { SiteSummary } from "./sites.utils";
import type { SiteAnalyticsSummary } from "../../lib/site-analytics";

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
  const maxGrowth = Math.max(...analytics.last30Days.subscriberGrowth.map((item) => item.newSubscribers), 1);

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

      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        {analytics.last30Days.subscriberGrowth.map((item) => (
          <div key={item.date} style={{ display: "grid", gridTemplateColumns: "120px 1fr 72px", gap: 12, alignItems: "center" }}>
            <span className="subtle">{item.date}</span>
            <div className="growth-bar-track">
              <div
                className="growth-bar-fill"
                style={{ width: `${Math.max((item.newSubscribers / maxGrowth) * 100, 8)}%` }}
              />
            </div>
            <strong>{formatNumber(item.newSubscribers)}</strong>
          </div>
        ))}
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
