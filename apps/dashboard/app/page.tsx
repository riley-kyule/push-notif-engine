import type { CSSProperties } from "react";
import Link from "next/link";

import { DashboardShell } from "./_components/dashboard-shell";
import { getAnalyticsDashboardData } from "./_data/analytics";
import { getCampaignList } from "./_data/campaigns";
import { getDashboardOverview } from "./_data/overview";
import { buildOverviewCards, buildPerformanceRankingCards } from "./_data/overview-summary-cards";
import { getPlatformHealthBadge, getPlatformHealthSummary, getPlatformHealthTone, summarizePlatformHealth } from "./_data/platform-health";
import { getStorageHealthSummary } from "./_data/storage-health";

export default async function DashboardHome() {
  const [overview, analytics, campaigns, platformHealthRaw] = await Promise.all([
    getDashboardOverview(),
    getAnalyticsDashboardData({ preset: "30d", days: "30" }),
    getCampaignList(),
    getPlatformHealthSummary(),
  ]);
  const storageHealth = await getStorageHealthSummary();
  const platformHealth = summarizePlatformHealth(platformHealthRaw);
  const platformHealthBadge = getPlatformHealthBadge(platformHealth.score);
  const platformHealthTone = getPlatformHealthTone(platformHealth.status);
  const platformHealthSourceLabel =
    platformHealth.source === "live" ? "Live data" : platformHealth.source === "demo" ? "Demo snapshot" : "Unavailable";
  const platformHealthRingStyle = {
    ["--health-score" as const]: String(platformHealth.score),
  } as CSSProperties & { [key: `--${string}`]: string };
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
          <span className={`badge ${storageHealth.badgeClass}`}>{storageHealth.label}</span>
          <span className={`badge ${platformHealthTone}`}>{platformHealthBadge.label}</span>
          <Link className="button secondary" href="/platform-health">
            Platform health
          </Link>
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
      <section className="grid cards-2 overview-health-grid">
        <Link className="card overview-health-card" href="/platform-health" aria-label={`Platform health score ${platformHealth.score} percent`}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Platform health</p>
              <h3>Live status ring</h3>
            </div>
            <span className={`badge ${platformHealthTone}`}>{platformHealthBadge.label}</span>
          </div>
          <p className={`subtle ${platformHealth.source === "live" ? "" : "platform-health-source"}`}>{platformHealthSourceLabel}</p>
          <div className="overview-health-ring" style={platformHealthRingStyle}>
            <div className="overview-health-ring-inner">
              <strong>{platformHealth.score}%</strong>
              <span>score</span>
            </div>
          </div>
          <p className="overview-health-copy">
            Quick read on the services that keep delivery flowing.
          </p>
        </Link>

        <div className="card overview-health-summary">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Operations</p>
              <h3>System checks</h3>
            </div>
          </div>
          <div className="overview-health-summary-grid">
            {platformHealth.components.map((component) => (
              <div key={component.key} className="overview-health-summary-item">
                <strong>{component.label}</strong>
                <span>{component.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

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
