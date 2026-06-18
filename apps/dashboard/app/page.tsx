import Link from "next/link";

import { DashboardShell } from "./_components/dashboard-shell";
import { getCampaignList } from "./_data/campaigns";
import { getDashboardOverview } from "./_data/overview";

export default async function DashboardHome() {
  const [campaigns, overview] = await Promise.all([getCampaignList(), getDashboardOverview()]);

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
      {overview.totalSites === 0 ? (
        <section className="card" style={{ marginBottom: 18 }}>
          <h3>No sites yet</h3>
          <p className="subtle">
            Add your first Exotic website to start collecting subscribers and sending campaigns.
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <Link className="button primary" href="/sites/new">
              Add your first site
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid cards-4">
        <article className="card">
          <h3>Total subscribers</h3>
          <p className="stat">{overview.totalSubscribers.toLocaleString()}</p>
          <p className="subtle">Across {overview.totalSites} Exotic {overview.totalSites === 1 ? "site" : "sites"}</p>
        </article>
        <article className="card">
          <h3>Active campaigns</h3>
          <p className="stat">{overview.activeCampaigns}</p>
          <p className="subtle">{overview.totalCampaigns} total campaigns</p>
        </article>
        <article className="card">
          <h3>30-day CTR</h3>
          <p className="stat">{overview.clickThroughRate}%</p>
          <p className="subtle">{overview.totalClicked.toLocaleString()} clicks tracked</p>
        </article>
        <article className="card">
          <h3>Delivery rate</h3>
          <p className="stat">{overview.deliveryRate}%</p>
          <p className="subtle">Queue-backed browser and mobile delivery</p>
        </article>
      </section>

      <section className="grid cards-3" style={{ marginTop: 18 }}>
        <article className="card">
          <h3>Queue health</h3>
          <p className="subtle">Pending and failed deliveries over the last 30 days.</p>
          <div className="kpi-bar">
            <div className="kpi">
              <strong>{overview.totalPending}</strong>
              <span className="subtle">Pending deliveries</span>
            </div>
            <div className="kpi">
              <strong>{overview.totalFailed}</strong>
              <span className="subtle">Failed (30d)</span>
            </div>
          </div>
        </article>
        <article className="card">
          <h3>Mobile readiness</h3>
          <p className="subtle">Browser push is mobile-capable on Android Chrome and iOS Safari 16.4+.</p>
          <div className="badge sent">Enabled</div>
        </article>
        <article className="card">
          <h3>Recent campaigns</h3>
          {campaigns.items.length === 0 ? (
            <p className="subtle">No campaigns yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {campaigns.items.slice(0, 3).map((campaign) => (
                <li key={campaign.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>
                    <strong>{campaign.name}</strong>
                    <br />
                    <span className="subtle">{campaign.site}</span>
                  </span>
                  <span className={`badge ${campaign.status}`}>{campaign.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </DashboardShell>
  );
}
