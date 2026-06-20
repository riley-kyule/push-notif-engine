import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getAnalyticsDashboardData } from "../_data/analytics";

const rangeOptions = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

function buildQuery(params: { days: number; siteId?: string; campaignId?: string }): string {
  const search = new URLSearchParams({ days: String(params.days) });
  if (params.siteId) {
    search.set("siteId", params.siteId);
  }
  if (params.campaignId) {
    search.set("campaignId", params.campaignId);
  }
  return `/analytics?${search.toString()}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; siteId?: string; campaignId?: string }>;
}) {
  const query = await searchParams;
  const dashboard = await getAnalyticsDashboardData(query);
  const currentFilters = {
    days: dashboard.days,
    siteId: dashboard.selectedSite.id,
    ...(dashboard.selectedCampaign ? { campaignId: dashboard.selectedCampaign.id } : {}),
  };

  const maxGrowth = Math.max(...dashboard.siteAnalytics.last30Days.subscriberGrowth.map((item) => item.newSubscribers), 1);
  const maxCountrySubscribers = Math.max(...dashboard.countryPerformance.map((item) => item.totalSubscribers), 1);
  const maxSiteSubscribers = Math.max(...dashboard.sitePerformance.map((item) => item.totalSubscribers), 1);
  const maxHourVolume = Math.max(...dashboard.timePerformance.map((item) => item.totalDelivered + item.totalSent), 1);

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Reporting command center"
      description="Track delivery health, subscriber growth, and campaign performance from a single reporting surface."
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
      <section className="card analytics-hero">
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            Phase 7 foundation
          </p>
          <h2>Turn live delivery events into decisions.</h2>
          <p>
            This reporting surface is driven by delivery events, subscriber growth, and campaign outcomes. The current
            window is <strong>{dashboard.rangeLabel}</strong>, and site scope plus campaign selection stay visible so the
            numbers remain easy to trust.
          </p>
        </div>

        <div className="analytics-range">
          {rangeOptions.map((option) => (
            <Link
              key={option.days}
              className={`analytics-range-chip ${dashboard.days === option.days ? "active" : ""}`}
              href={buildQuery({ ...currentFilters, days: option.days })}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid cards-4" style={{ marginTop: 18 }}>
        <article className="card">
          <h3>Total subscribers</h3>
          <p className="stat">{formatNumber(dashboard.overview.totalSubscribers)}</p>
          <p className="subtle">Across {dashboard.overview.totalSites} sites</p>
        </article>
        <article className="card">
          <h3>Delivered</h3>
          <p className="stat">{formatNumber(dashboard.overview.totalDelivered)}</p>
          <p className="subtle">Within the selected window</p>
        </article>
        <article className="card">
          <h3>Clicks</h3>
          <p className="stat">{formatNumber(dashboard.overview.totalClicked)}</p>
          <p className="subtle">CTR {formatPercent(dashboard.overview.clickThroughRate)}</p>
        </article>
        <article className="card">
          <h3>Failed</h3>
          <p className="stat">{formatNumber(dashboard.overview.totalFailed)}</p>
          <p className="subtle">Queue and delivery exceptions</p>
        </article>
      </section>

      <section className="analytics-layout" style={{ marginTop: 18 }}>
        <section className="card analytics-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Site performance</p>
              <h3>{dashboard.selectedSite.name}</h3>
            </div>
            <span className="badge active">{dashboard.selectedSite.status}</span>
          </div>

          <form className="analytics-selectors" action="/analytics" method="get">
            <input type="hidden" name="days" value={String(dashboard.days)} />
            <input type="hidden" name="campaignId" value={dashboard.selectedCampaign?.id ?? ""} />
            <div className="field">
              <label htmlFor="analytics-site">Site</label>
              <select id="analytics-site" name="siteId" className="select" defaultValue={dashboard.selectedSite.id}>
                {dashboard.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} - {site.country}
                  </option>
                ))}
              </select>
            </div>
            <button className="button secondary" type="submit">
              View site
            </button>
          </form>

          <div className="grid cards-3" style={{ marginTop: 16 }}>
            <article className="card">
              <p className="subtle">Total subscribers</p>
              <p className="stat">{formatNumber(dashboard.siteAnalytics.totalSubscribers)}</p>
            </article>
            <article className="card">
              <p className="subtle">Active subscribers</p>
              <p className="stat">{formatNumber(dashboard.siteAnalytics.activeSubscribers)}</p>
            </article>
            <article className="card">
              <p className="subtle">Delivery rate</p>
              <p className="stat">
                {dashboard.siteAnalytics.last30Days.totalDelivered > 0
                  ? formatPercent(
                      Math.round(
                        (dashboard.siteAnalytics.last30Days.totalDelivered /
                          Math.max(dashboard.siteAnalytics.last30Days.totalSent, 1)) *
                          10000,
                      ) / 100,
                    )
                  : "0%"}
              </p>
            </article>
          </div>

          <div className="analytics-growth">
            {dashboard.siteAnalytics.last30Days.subscriberGrowth.map((item) => (
              <div key={item.date} className="analytics-growth-row">
                <span className="subtle">{item.date}</span>
                <div className="analytics-growth-track">
                  <div className="analytics-growth-fill" style={{ width: `${Math.max((item.newSubscribers / maxGrowth) * 100, 8)}%` }} />
                </div>
                <strong>{formatNumber(item.newSubscribers)}</strong>
              </div>
            ))}
          </div>
        </section>

        <aside className="analytics-sidebar">
          <section className="card analytics-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Campaign performance</p>
                <h3>{dashboard.selectedCampaign?.name ?? "No campaign selected"}</h3>
              </div>
              <span className={`badge ${dashboard.selectedCampaign?.status ?? "draft"}`}>{dashboard.selectedCampaign?.status ?? "draft"}</span>
            </div>

            <form className="analytics-selectors" action="/analytics" method="get">
              <input type="hidden" name="days" value={String(dashboard.days)} />
              <input type="hidden" name="siteId" value={dashboard.selectedSite.id} />
              <div className="field">
                <label htmlFor="analytics-campaign">Campaign</label>
                <select id="analytics-campaign" name="campaignId" className="select" defaultValue={dashboard.selectedCampaign?.id ?? ""}>
                  {dashboard.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} - {campaign.status}
                    </option>
                  ))}
                </select>
              </div>
              <button className="button secondary" type="submit">
                View campaign
              </button>
            </form>

            {dashboard.selectedCampaign ? (
              <div className="analytics-campaign-card">
                <p className="subtle">{dashboard.selectedCampaign.site}</p>
                <p>{dashboard.selectedCampaign.message}</p>
                <div className="grid cards-2 analytics-mini-grid">
                  <article className="card">
                    <p className="subtle">Sent</p>
                    <p className="stat">{dashboard.selectedCampaign.metrics.sent}</p>
                  </article>
                  <article className="card">
                    <p className="subtle">Delivered</p>
                    <p className="stat">{dashboard.selectedCampaign.metrics.delivered}</p>
                  </article>
                  <article className="card">
                    <p className="subtle">Clicks</p>
                    <p className="stat">{dashboard.selectedCampaign.metrics.clicks}</p>
                  </article>
                  <article className="card">
                    <p className="subtle">CTR</p>
                    <p className="stat">{dashboard.selectedCampaign.metrics.ctr}</p>
                  </article>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card analytics-panel">
            <p className="eyebrow">Controlled taxonomy</p>
            <h3>UTM defaults stay consistent.</h3>
            <p className="subtle">
              Campaign content types should seed a default UTM template so reporting stays comparable across sites.
              Overrides can remain controlled at the campaign level.
            </p>
            <div className="taxonomy-list">
              <span className="badge sent">Content taxonomy</span>
              <span className="badge scheduled">UTM defaults</span>
              <span className="badge active">Export ready</span>
            </div>
          </section>
        </aside>
      </section>

      <section className="grid cards-2" style={{ marginTop: 18 }}>
        <section className="card analytics-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Country performance</p>
              <h3>Top regions by delivery volume</h3>
            </div>
            <span className="badge sent">Live</span>
          </div>

          <div className="analytics-list">
            {dashboard.countryPerformance.map((item) => (
              <article key={item.country} className="analytics-list-row">
                <div className="analytics-list-labels">
                  <strong>{item.country}</strong>
                  <span className="subtle">{formatNumber(item.totalSubscribers)} subscribers</span>
                </div>
                <div className="analytics-list-track">
                  <div className="analytics-list-fill" style={{ width: `${Math.max((item.totalSubscribers / maxCountrySubscribers) * 100, 8)}%` }} />
                </div>
                <div className="analytics-list-metrics">
                  <strong>{formatPercent(item.deliveryRate)} delivery</strong>
                  <span className="subtle">CTR {formatPercent(item.clickThroughRate)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card analytics-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Time performance</p>
              <h3>Delivery volume by hour</h3>
            </div>
            <span className="badge active">UTC</span>
          </div>

          <div className="analytics-list">
            {dashboard.timePerformance.slice(0, 12).map((item) => {
              const totalVolume = item.totalDelivered + item.totalSent;
              return (
                <article key={item.hour} className="analytics-list-row">
                  <div className="analytics-list-labels">
                    <strong>{String(item.hour).padStart(2, "0")}:00</strong>
                    <span className="subtle">{formatNumber(totalVolume)} events</span>
                  </div>
                  <div className="analytics-list-track">
                    <div className="analytics-list-fill" style={{ width: `${Math.max((totalVolume / maxHourVolume) * 100, 8)}%` }} />
                  </div>
                  <div className="analytics-list-metrics">
                    <strong>{formatPercent(item.deliveryRate)} delivery</strong>
                    <span className="subtle">CTR {formatPercent(item.clickThroughRate)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      <section className="card analytics-panel" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Site performance</p>
            <h3>Cross-site delivery comparison</h3>
          </div>
          <span className="badge scheduled">{dashboard.sitePerformance.length} sites</span>
        </div>

        <div className="analytics-table">
          <div className="analytics-table-head">
            <span>Site</span>
            <span>Subscribers</span>
            <span>Delivery rate</span>
            <span>CTR</span>
          </div>
          {dashboard.sitePerformance.map((item) => (
            <div key={item.siteId} className="analytics-table-row">
              <div>
                <strong>{item.siteName}</strong>
                <p className="subtle">{item.siteId}</p>
              </div>
              <span>{formatNumber(item.totalSubscribers)}</span>
              <span>{formatPercent(item.deliveryRate)}</span>
              <span>{formatPercent(item.clickThroughRate)}</span>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
