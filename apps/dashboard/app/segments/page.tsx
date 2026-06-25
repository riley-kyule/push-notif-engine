import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { formatDisplayDate } from "../_components/format-date";
import { fallbackSiteChoices, getSiteChoices } from "../_data/sites";
import { getFallbackSegmentSummaries, getSegmentSummaries } from "../_data/segments-dashboard";

function formatDate(value: string): string {
  return formatDisplayDate(value);
}

export default async function SegmentsPage() {
  const [sites, segments] = await Promise.all([
    getSiteChoices().catch(() => fallbackSiteChoices),
    getSegmentSummaries().catch(() => getFallbackSegmentSummaries()),
  ]);

  return (
    <DashboardShell
      eyebrow="Automation"
      title="Segments"
      description="Build and review audience targeting rules for campaign delivery."
      actions={
        <>
          <Link className="button secondary" href="/workflow">
            Workflow
          </Link>
          <Link className="button primary" href="/campaigns/new">
            New campaign
          </Link>
        </>
      }
    >
      <section className="grid cards-3">
        <article className="card">
          <p className="eyebrow">Sites</p>
          <p className="stat">{sites.length}</p>
          <p className="subtle">All configured Exotic sites</p>
        </article>
        <article className="card">
          <p className="eyebrow">Segments</p>
          <p className="stat">{segments.length}</p>
          <p className="subtle">Active and archived audience rules</p>
        </article>
        <article className="card">
          <p className="eyebrow">Rule coverage</p>
          <p className="stat">{segments.reduce((total, segment) => total + segment.ruleCount, 0)}</p>
          <p className="subtle">Segment rules currently in play</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Audience targeting</p>
            <h3>Saved segments</h3>
          </div>
          <span className="badge active">Live from API</span>
        </div>

        <div className="workflow-feed-list">
          {segments.map((segment) => (
            <article key={segment.id} className="workflow-feed-card">
              <div className="workflow-feed-card-header">
                <div>
                  <strong>{segment.name}</strong>
                  <p className="subtle">{segment.description ?? "No description"}</p>
                </div>
                <span className={`badge ${segment.status}`}>{segment.status}</span>
              </div>

              <div className="workflow-feed-meta">
                <div>
                  <span className="subtle">Scope</span>
                  <strong>{sites.find((site) => site.id === segment.siteId)?.name ?? segment.siteId}</strong>
                </div>
                <div>
                  <span className="subtle">Match mode</span>
                  <strong>{segment.matchMode.toUpperCase()}</strong>
                </div>
                <div>
                  <span className="subtle">Rules</span>
                  <strong>{segment.ruleCount}</strong>
                </div>
                <div>
                  <span className="subtle">Updated</span>
                  <strong>{formatDate(segment.updatedAt)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
