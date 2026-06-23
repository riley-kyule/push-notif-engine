import type { CSSProperties } from "react";
import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getPlatformHealthBadge, getPlatformHealthSummary, getPlatformHealthTone, summarizePlatformHealth } from "../_data/platform-health";
import { DeploymentActionsPanel } from "./deployment-actions-panel";

function formatScore(value: number): string {
  return `${Math.round(value)}%`;
}

export default async function PlatformHealthPage() {
  const health = summarizePlatformHealth(await getPlatformHealthSummary());
  const badge = getPlatformHealthBadge(health.score);
  const toneClass = getPlatformHealthTone(health.status);
  const sourceLabel =
    health.source === "live" ? "Live data" : health.source === "demo" ? "Demo snapshot" : "Unavailable";
  const ringStyle = {
    ["--health-score" as const]: String(health.score),
  } as CSSProperties & { [key: `--${string}`]: string };

  return (
    <DashboardShell
      eyebrow="Platform"
      title="Platform health"
      description="Monitor database, queue broker, and storage health in one compact view."
      actions={
        <>
          <span className={`badge ${toneClass}`}>{badge.label}</span>
          <span className={`badge ${health.source === "live" ? "good" : health.source === "demo" ? "warn" : "neutral"}`}>{sourceLabel}</span>
          <Link className="button secondary" href="/sites">
            Sites
          </Link>
          <Link className="button secondary" href="/analytics">
            Analytics
          </Link>
        </>
      }
    >
      <section className="grid cards-2 platform-health-hero">
        <article className="card platform-health-overview">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Health summary</p>
              <h3>Current platform state</h3>
            </div>
            <p className="subtle">Last checked {health.checkedAt ? new Date(health.checkedAt).toLocaleString() : "just now"}</p>
          </div>

          <div className="platform-health-copy">
            <p className="platform-health-lead">
              The platform score is a weighted snapshot of the services that matter most for push delivery.
            </p>
            <div className="platform-health-bullets">
              <div>
                <strong>Database</strong>
                <span>PostgreSQL availability and query response</span>
              </div>
              <div>
                <strong>Queue broker</strong>
                <span>Redis health for BullMQ and rate limiting</span>
              </div>
              <div>
                <strong>Storage</strong>
                <span>Campaign media bucket availability</span>
              </div>
            </div>
          </div>
        </article>

        <article className="card platform-health-score-card">
          <div className="platform-health-score-ring" style={ringStyle}>
            <div className="platform-health-score-ring-inner">
              <strong>{formatScore(health.score)}</strong>
              <span>Platform score</span>
            </div>
          </div>
          <div className="platform-health-score-meta">
            <p className="analytics-summary-label">Overall status</p>
            <p className="platform-health-score-status">{health.status}</p>
            <p className="subtle">{sourceLabel}</p>
            <p className="subtle">Higher scores reflect more services operating normally.</p>
          </div>
        </article>
      </section>

      <section className="card platform-health-alerts">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Alerts</p>
            <h3>What needs attention</h3>
          </div>
          <span className={`badge ${health.alerts.length ? "warn" : "good"}`}>{health.alerts.length} active</span>
        </div>
        {health.alerts.length ? (
          <div className="platform-health-alert-list">
            {health.alerts.map((alert) => (
              <article key={alert.key} className={`platform-health-alert platform-health-alert--${alert.severity}`}>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="subtle">No active alerts. The platform is healthy across the currently monitored signals.</p>
        )}
      </section>

      <section className="card platform-health-components">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Service checks</p>
            <h3>Breakdown by platform component</h3>
          </div>
          <span className={`badge ${toneClass}`}>{health.components.filter((component) => component.status === "healthy").length}/{health.components.length} healthy</span>
        </div>

        <div className="platform-health-grid">
          {health.components.map((component) => (
            <article key={component.key} className="platform-health-component">
              <div className="platform-health-component-head">
                <div>
                  <p className="platform-health-component-label">{component.label}</p>
                  <p className="subtle">{component.detail}</p>
                </div>
                <span className={`badge ${component.status === "healthy" ? "active" : "failed"}`}>{component.status}</span>
              </div>

              <div className="platform-health-component-score">
                <strong>{formatScore(component.score)}</strong>
                <span>of {formatScore(component.weight)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cards-3">
        {health.queueDepth.map((queue) => (
          <article key={queue.key} className="card platform-health-queue-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Queue depth</p>
                <h3>{queue.label}</h3>
              </div>
            </div>
            <div className="platform-health-queue-stats">
              <div>
                <strong>{queue.waiting}</strong>
                <span>Waiting</span>
              </div>
              <div>
                <strong>{queue.active}</strong>
                <span>Active</span>
              </div>
              <div>
                <strong>{queue.delayed}</strong>
                <span>Delayed</span>
              </div>
              <div>
                <strong>{queue.failed}</strong>
                <span>Failed</span>
              </div>
            </div>
          </article>
        ))}

        <article className="card platform-health-heartbeat-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Worker heartbeat</p>
              <h3>Delivery workers</h3>
            </div>
          </div>
          <div className="platform-health-heartbeat-list">
            {health.workerHeartbeats.length ? (
              health.workerHeartbeats.map((worker) => (
                <div key={worker.key} className="platform-health-heartbeat-item">
                  <div>
                    <strong>{worker.label}</strong>
                    <span>
                      {worker.lastSeenAt ? `Last seen ${new Date(worker.lastSeenAt).toLocaleTimeString()}` : "No heartbeat"}
                      {" · "}
                      {Math.round(worker.uptimeMs / 1000).toLocaleString()}s uptime
                      {" · "}
                      {worker.redisLatencyMs}ms Redis
                    </span>
                  </div>
                  <span className={`badge ${worker.status === "healthy" ? "good" : worker.status === "stale" ? "warn" : "bad"}`}>
                    {worker.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="subtle">No worker heartbeat has been recorded yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid cards-2">
        <article className="card platform-health-delivery-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Site delivery</p>
              <h3>Highest delivery rate</h3>
            </div>
          </div>
          <div className="platform-health-site-list">
            {health.siteHealth.highestDelivery.length ? (
              health.siteHealth.highestDelivery.map((site) => (
                <Link key={site.siteId} href={`/analytics?section=site&siteId=${site.siteId}`} className="platform-health-site-item">
                  <div>
                    <strong>{site.siteName}</strong>
                    <span>{site.totalDelivered.toLocaleString()} delivered · {site.totalFailed.toLocaleString()} failed</span>
                  </div>
                  <strong>{formatScore(site.deliveryRate)}</strong>
                </Link>
              ))
            ) : (
              <p className="subtle">No delivery data available yet.</p>
            )}
          </div>
        </article>

        <article className="card platform-health-delivery-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Site delivery</p>
              <h3>Lowest delivery rate</h3>
            </div>
          </div>
          <div className="platform-health-site-list">
            {health.siteHealth.lowestDelivery.length ? (
              health.siteHealth.lowestDelivery.map((site) => (
                <Link key={site.siteId} href={`/analytics?section=site&siteId=${site.siteId}`} className="platform-health-site-item">
                  <div>
                    <strong>{site.siteName}</strong>
                    <span>{site.totalDelivered.toLocaleString()} delivered · {site.totalFailed.toLocaleString()} failed</span>
                  </div>
                  <strong>{formatScore(site.deliveryRate)}</strong>
                </Link>
              ))
            ) : (
              <p className="subtle">No delivery data available yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid cards-2">
        <article className="card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Operations</p>
              <h3>What to check next</h3>
            </div>
          </div>

          <div className="platform-health-actions">
            <Link href="/sites" className="platform-health-action">
              Review site credentials and branding
            </Link>
            <Link href="/campaigns" className="platform-health-action">
              Confirm campaign delivery activity
            </Link>
            <Link href="/workflow" className="platform-health-action">
              Check workflow and RSS automation
            </Link>
          </div>
        </article>

        <article className="card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Notes</p>
              <h3>Interpreting the score</h3>
            </div>
          </div>
          <p className="subtle">
            The score is intentionally compact. It gives a quick read on the services that affect push delivery the
            most. When any component drops, the page stays readable and the score shifts without breaking the layout.
          </p>
        </article>
      </section>

      <DeploymentActionsPanel />
    </DashboardShell>
  );
}
