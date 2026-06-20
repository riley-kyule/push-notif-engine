import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getSiteChoices } from "../_data/sites";
import { getWorkflowDashboardData } from "../_data/workflows";
import { WorkflowManager } from "./workflow-manager";

export default async function WorkflowPage() {
  const [sites, dashboard] = await Promise.all([getSiteChoices(), getWorkflowDashboardData()]);

  return (
    <DashboardShell
      eyebrow="Workflow"
      title="Automation studio"
      description="Manage workflow triggers, RSS polling, and event-driven actions without leaving the dashboard."
      actions={
        <>
          <Link className="button secondary" href="/campaigns/new">
            New campaign
          </Link>
          <Link className="button primary" href="/workflow">
            Refresh
          </Link>
        </>
      }
    >
      <section className="hero-card">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Phase 6 control plane
          </div>
          <h2>Trigger, route, and observe automation in one place.</h2>
          <p>
            RSS feeds, workflow events, subscriber tags, and notification dispatch share the same event log so the
            dashboard stays operational instead of decorative.
          </p>
        </div>

        <div className="hero-metrics">
          <article className="metric-chip">
            <span className="subtle">Feeds</span>
            <strong>{dashboard.feeds.length}</strong>
          </article>
          <article className="metric-chip">
            <span className="subtle">Completed</span>
            <strong>{dashboard.events.filter((event) => event.status === "completed").length}</strong>
          </article>
          <article className="metric-chip">
            <span className="subtle">Pending</span>
            <strong>{dashboard.events.filter((event) => event.status === "pending").length}</strong>
          </article>
          <article className="metric-chip">
            <span className="subtle">Failed</span>
            <strong>{dashboard.events.filter((event) => event.status === "failed").length}</strong>
          </article>
        </div>
      </section>

      <section className="workflow-grid">
        <WorkflowManager sites={sites} feeds={dashboard.feeds} events={dashboard.events} />

        <aside className="workflow-sidebar">
          <section className="card">
            <h3>Workflow status</h3>
            <p className="subtle">Live event intake from subscriber registrations, page activity, and RSS polling.</p>
            <div className="status-list">
              <div>
                <span className="status-dot success" />
                <strong>Subscriber registrations</strong>
                <p className="subtle">Automatically enter the workflow engine when a new subscriber arrives.</p>
              </div>
              <div>
                <span className="status-dot warning" />
                <strong>RSS polling</strong>
                <p className="subtle">Feeds are polled on a schedule and rechecked on demand.</p>
              </div>
              <div>
                <span className="status-dot info" />
                <strong>Webhooks</strong>
                <p className="subtle">Workflow actions can fan out to internal or external systems.</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>Recent events</h3>
            <div className="workflow-feed">
              {dashboard.events.map((event) => (
                <article key={event.id} className="workflow-event-row">
                  <div>
                    <strong>{event.triggerEvent}</strong>
                    <p className="subtle">{event.siteId}</p>
                  </div>
                  <span className={`badge ${event.status}`}>{event.status}</span>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
