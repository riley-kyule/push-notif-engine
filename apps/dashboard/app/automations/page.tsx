import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { fallbackSiteChoices, getSiteChoices } from "../_data/sites";
import { getFallbackAutomations, getAutomationSummaries } from "../_data/automations";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AutomationsPage() {
  const [sites, automations] = await Promise.all([
    getSiteChoices().catch(() => fallbackSiteChoices),
    getAutomationSummaries().catch(() => getFallbackAutomations()),
  ]);

  return (
    <DashboardShell
      eyebrow="Automation"
      title="Automation rules"
      description="Manage trigger-driven notification, tagging, and webhook rules across Exotic sites."
      actions={
        <>
          <Link className="button secondary" href="/workflow">
            Workflow
          </Link>
          <Link className="button primary" href="/segments">
            Segments
          </Link>
        </>
      }
    >
      <section className="grid cards-3">
        <article className="card">
          <p className="eyebrow">Sites</p>
          <p className="stat">{sites.length}</p>
          <p className="subtle">Configured Exotic properties</p>
        </article>
        <article className="card">
          <p className="eyebrow">Rules</p>
          <p className="stat">{automations.length}</p>
          <p className="subtle">Trigger-driven automations</p>
        </article>
        <article className="card">
          <p className="eyebrow">Active rules</p>
          <p className="stat">{automations.filter((automation) => automation.status === "active").length}</p>
          <p className="subtle">Currently live automations</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Rule engine</p>
            <h3>Automation library</h3>
          </div>
          <span className="badge active">Live from API</span>
        </div>

        <div className="workflow-feed-list">
          {automations.map((automation) => (
            <article key={automation.id} className="workflow-feed-card">
              <div className="workflow-feed-card-header">
                <div>
                  <strong>{automation.name}</strong>
                  <p className="subtle">{automation.title}</p>
                </div>
                <span className={`badge ${automation.status}`}>{automation.status}</span>
              </div>

              <div className="workflow-feed-meta">
                <div>
                  <span className="subtle">Scope</span>
                  <strong>{sites.find((site) => site.id === automation.siteId)?.name ?? automation.siteId}</strong>
                </div>
                <div>
                  <span className="subtle">Trigger</span>
                  <strong>{automation.triggerEvent.replaceAll("_", " ")}</strong>
                </div>
                <div>
                  <span className="subtle">Actions</span>
                  <strong>{automation.actionCount}</strong>
                </div>
                <div>
                  <span className="subtle">Updated</span>
                  <strong>{formatDate(automation.updatedAt)}</strong>
                </div>
              </div>

              <p className="subtle">{automation.message}</p>
              <p className="subtle mono">{automation.url}</p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
