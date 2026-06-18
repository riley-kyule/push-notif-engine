import Link from "next/link";

import { DashboardShell } from "./_components/dashboard-shell";
import { getCampaignList } from "./_data/campaigns";

export default async function DashboardHome() {
  const campaigns = await getCampaignList();

  return (
    <DashboardShell
      eyebrow="Overview"
      title="Campaign control for Exotic"
      description="Track delivery health, queue pressure, and campaign cadence across every Exotic site from one dashboard."
      actions={
        <>
          <Link className="button secondary" href="/campaigns">
            View campaigns
          </Link>
          <Link className="button primary" href="/campaigns/new">
            Create campaign
          </Link>
        </>
      }
    >
      <section className="grid cards-4">
        <article className="card">
          <h3>Total subscribers</h3>
          <p className="stat">4.2M</p>
          <p className="subtle">Across 110+ Exotic websites</p>
        </article>
        <article className="card">
          <h3>Active campaigns</h3>
          <p className="stat">3</p>
          <p className="subtle">1 scheduled, 1 sent, 1 draft</p>
        </article>
        <article className="card">
          <h3>7-day CTR</h3>
          <p className="stat">6.8%</p>
          <p className="subtle">Strongest across mobile audience</p>
        </article>
        <article className="card">
          <h3>Delivery rate</h3>
          <p className="stat">98.1%</p>
          <p className="subtle">Queue-backed browser and mobile delivery</p>
        </article>
      </section>

      <section className="grid cards-3" style={{ marginTop: 18 }}>
        <article className="card">
          <h3>Queue health</h3>
          <p className="subtle">Browser queue depth remains within target.</p>
          <div className="kpi-bar">
            <div className="kpi">
              <strong>18</strong>
              <span className="subtle">Pending jobs</span>
            </div>
            <div className="kpi">
              <strong>3</strong>
              <span className="subtle">Workers online</span>
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
        </article>
      </section>
    </DashboardShell>
  );
}
