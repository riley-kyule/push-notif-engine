import { notFound } from "next/navigation";

import { DashboardShell } from "../../_components/dashboard-shell";
import { BrowserPushPanel } from "../browser-push-panel";
import { BrowserPushDispatchPanel } from "../browser-push-dispatch-panel";
import { MobilePushPanel } from "../mobile-push-panel";
import { SiteAnalyticsPanel } from "../site-analytics-panel";
import { RestApiPanel } from "../rest-api-panel";
import { getSiteAnalytics } from "../../../lib/site-analytics";
import { getConnectionStatus, getSiteById } from "../sites.utils";
import { SiteActions } from "./site-actions";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getSiteById(id);

  if (!site) {
    notFound();
  }

  const analytics = await getSiteAnalytics(site);
  const connection = getConnectionStatus(site.lastConnectedAt);

  return (
    <DashboardShell
      eyebrow="Sites"
      title={site.name}
      description="Inspect the integration status, credentials, and deployment details for this Exotic site."
      actions={<SiteActions site={site} />}
    >
      <section className="grid cards-4">
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
          <p className={`badge ${connection.badgeClass}`} style={{ marginTop: 6 }}>
            {connection.label}
          </p>
          <p className="subtle">Plugin connection is detected from its own config requests to the API</p>
        </article>
        <article className="card">
          <h3>Branding</h3>
          <p className="stat">{site.appName}</p>
          <p className="subtle">{site.themeColor}</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Integrations</h3>
        <p className="subtle">Site Key (WordPress plugin &amp; SDK)</p>
        <p className="mono">{site.id}</p>
        <p className="subtle">Site URL</p>
        <p>{site.url}</p>
        <p className="subtle">Icon URL</p>
        <p className="mono">{site.iconUrl || "Not configured"}</p>
        <p className="subtle">Platform</p>
        <p>{site.platform}</p>
        <p className="subtle">VAPID public key</p>
        <p className="mono">{site.vapidPublicKey ?? "Not configured"}</p>
      </section>

      <RestApiPanel site={site} />

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Opt-in Prompt Settings</h3>
        <div className="grid cards-3" style={{ marginTop: 12 }}>
          <article className="card">
            <p className="subtle">Template</p>
            <p className="stat">{site.optInPromptType.replace("-", " ")}</p>
            <p className="subtle">{site.optInPromptAnimation} animation</p>
          </article>
          <article className="card">
            <p className="subtle">Headline</p>
            <p className="stat">{site.optInPromptHeadline}</p>
            <p className="subtle">{site.optInPromptText}</p>
          </article>
          <article className="card">
            <p className="subtle">Buttons</p>
            <p className="stat">{site.optInPromptCancelButtonLabel} / {site.optInPromptApproveButtonLabel}</p>
            <p className="subtle">Reprompt after {site.optInPromptRepromptDelayDays} day(s)</p>
            <p className="subtle">Recent notifications: {site.optInPromptRecentNotificationsLimit}</p>
          </article>
        </div>
      </section>

      <BrowserPushPanel site={site} />
      <BrowserPushDispatchPanel site={site} />
      <MobilePushPanel site={site} />
      <SiteAnalyticsPanel site={site} analytics={analytics} />
    </DashboardShell>
  );
}
