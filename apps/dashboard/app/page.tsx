import Link from "next/link";

import { DashboardShell } from "./_components/dashboard-shell";
import { getAnalyticsDashboardData } from "./_data/analytics";
import { getCampaignList } from "./_data/campaigns";
import { getDashboardOverview } from "./_data/overview";
import { buildOverviewCards, buildPerformanceRankingCards } from "./_data/overview-summary-cards";

export default async function DashboardHome() {
  const [overview, analytics, campaigns] = await Promise.all([
    getDashboardOverview(),
    getAnalyticsDashboardData({ preset: "30d", days: "30" }),
    getCampaignList(),
  ]);
  const overviewCards = buildOverviewCards(overview);
  const rankingCards = buildPerformanceRankingCards({
    sites: analytics.sitePerformance,
    campaigns: campaigns.items,
  });

  return (
    <DashboardShell
      eyebrow="Overview"
      title="Campaign control for Exotic"
      description="Track delivery health, queue pressure, and campaign cadence across every Exotic site from one dashboard."
      actions={
        <>
          <Link className="button secondary" href="/sites/new">
            Add Site
          </Link>
          <Link className="button secondary" href="/campaigns">
            View campaigns
          </Link>
          <Link className="button primary" href="/campaigns/new">
            Create campaign
          </Link>
        </>
      }
      >
      <section className="grid cards-3">
        {overviewCards.map((item) => (
          <Link key={item.label} className="card overview-summary-link" href={item.href} aria-label={`${item.label}: ${item.value}`}>
            <p className="analytics-summary-label">{item.label}</p>
            <p className="analytics-summary-value">{item.value}</p>
            <p className="analytics-summary-detail">{item.detail}</p>
            <span className="overview-summary-cta">Open report</span>
          </Link>
        ))}
      </section>

      <section className="grid cards-2 overview-ranking-grid">
        {rankingCards.map((card) => (
          <article key={card.title} className="card overview-ranking-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{card.eyebrow}</p>
                <h3>{card.title}</h3>
              </div>
            </div>

            <div className="overview-ranking-columns">
              <div className="overview-ranking-group">
                <p className="overview-ranking-label">{card.highestLabel}</p>
                <div className="overview-ranking-list">
                  {card.highestItems.length ? (
                    card.highestItems.map((item, index) => (
                      <Link key={`${card.title}-${item.label}-${index}`} className="overview-ranking-item" href={item.href}>
                        <span className="overview-ranking-rank">{index + 1}</span>
                        <span className="overview-ranking-copy">
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="subtle">No ranked items yet.</p>
                  )}
                </div>
              </div>

              <div className="overview-ranking-group">
                <p className="overview-ranking-label">{card.lowestLabel}</p>
                <div className="overview-ranking-list">
                  {card.lowestItems.length ? (
                    card.lowestItems.map((item, index) => (
                      <Link key={`${card.title}-lowest-${item.label}-${index}`} className="overview-ranking-item" href={item.href}>
                        <span className="overview-ranking-rank overview-ranking-rank--muted">{index + 1}</span>
                        <span className="overview-ranking-copy">
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="subtle">No ranked items yet.</p>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
