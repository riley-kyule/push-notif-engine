import { notFound } from "next/navigation";

import { DashboardShell } from "../../_components/dashboard-shell";
import { BrowserPushPanel } from "../browser-push-panel";
import { BrowserPushDispatchPanel } from "../browser-push-dispatch-panel";
import { SiteAnalyticsPanel } from "../site-analytics-panel";
import { getSiteAnalytics } from "../../../lib/site-analytics";
import { getSiteById } from "../sites.utils";
import { SiteActions } from "./site-actions";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getSiteById(id);

  if (!site) {
    notFound();
  }

  const analytics = await getSiteAnalytics(site);

  return (
    <DashboardShell
      eyebrow="Sites"
      title={site.name}
      description="Inspect the integration status, credentials, and deployment details for this Exotic site."
      actions={<SiteActions site={site} />}
    >
      <section className="grid cards-3">
        <article className="card">
          <h3>Location</h3>
          <p className="stat">{site.country}</p>
          <p className="subtle">{site.language.toUpperCase()} locale</p>
        </article>
        <article className="card">
          <h3>Subscribers</h3>
          <p className="stat">{site.subscribers.toLocaleString()}</p>
          <p className="subtle">Web push subscribers linked to this site</p>
        </article>
        <article className="card">
          <h3>Status</h3>
          <p className={`badge ${site.status}`}>{site.status}</p>
          <p className="subtle">Push credentials and service worker readiness</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Integration</h3>
        <p className="subtle">Site URL</p>
        <p>{site.url}</p>
        <p className="subtle">Platform</p>
        <p>{site.platform}</p>
        <p className="subtle">VAPID public key</p>
        <p className="mono">{site.vapidPublicKey ?? "Not configured"}</p>
      </section>

      <BrowserPushPanel site={site} />
      <BrowserPushDispatchPanel site={site} />
      <SiteAnalyticsPanel site={site} analytics={analytics} />
    </DashboardShell>
  );
}
