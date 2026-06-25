import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect, PageSizeSelect, Pagination } from "../../_components/list-controls";
import { getFailedDeliveriesPage, getFailureReasons, getPushTypeLabel, type PushType } from "../../_data/failed-deliveries";
import { getSiteChoices } from "../../_data/sites";

const PUSH_TYPES: PushType[] = ["campaign", "automation", "manual"];

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function FailedDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    siteId?: string;
    pushType?: string;
    reason?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Number.parseInt(query.pageSize ?? "25", 10) || 25;
  const pushType = PUSH_TYPES.includes(query.pushType as PushType) ? (query.pushType as PushType) : undefined;

  const [result, sites, reasons] = await Promise.all([
    getFailedDeliveriesPage({
      siteId: query.siteId,
      pushType,
      reason: query.reason,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getSiteChoices(),
    getFailureReasons(),
  ]);

  const realSites = sites.filter((site) => site.id !== "site-3");

  const currentParams = {
    siteId: query.siteId,
    pushType: query.pushType,
    reason: query.reason,
    pageSize: String(pageSize),
  };

  const activeFilterCount = [query.siteId, query.pushType, query.reason].filter(Boolean).length;

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Failed deliveries"
      description="Every push that failed, with the site, the campaign/automation/manual push it came from, and why -- filterable so a recurring cause is easy to spot."
      actions={
        <Link className="button secondary" href="/analytics">
          Back to analytics
        </Link>
      }
    >
      <section className="card audit-logs-panel">
        <details className="filter-panel">
          <summary className="button secondary">
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}
          </summary>
          <div className="grid cards-3" style={{ marginTop: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="site-filter" className="subtle">
                Site
              </label>
              <FilterSelect
                basePath="/analytics/failures"
                currentParams={currentParams}
                paramKey="siteId"
                allLabel="All sites"
                options={realSites.map((site) => ({ value: site.id, label: site.name }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="push-type-filter" className="subtle">
                Push type
              </label>
              <FilterSelect
                basePath="/analytics/failures"
                currentParams={currentParams}
                paramKey="pushType"
                allLabel="All push types"
                options={PUSH_TYPES.map((type) => ({ value: type, label: getPushTypeLabel(type) }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="reason-filter" className="subtle">
                Reason
              </label>
              <FilterSelect
                basePath="/analytics/failures"
                currentParams={currentParams}
                paramKey="reason"
                allLabel="All reasons"
                options={reasons.map((entry) => ({ value: entry.reason, label: `${entry.reason} (${entry.count.toLocaleString()})` }))}
              />
            </div>
          </div>
        </details>

        <div className="report-toolbar" style={{ marginTop: 14 }}>
          <div>
            <strong>{result.total.toLocaleString()} failed deliveries</strong>
            <span>Most recent first</span>
          </div>
          <PageSizeSelect basePath="/analytics/failures" currentParams={currentParams} pageSize={pageSize} />
        </div>

        <div className="audit-logs-table-wrap" style={{ marginTop: 14 }}>
          <table className="audit-logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Site</th>
                <th>Push</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id}>
                  <td className="subtle">{formatTimestamp(row.createdAt)}</td>
                  <td>{row.siteName}</td>
                  <td>
                    <div className="stack-tight">
                      <strong>{getPushTypeLabel(row.pushType)}</strong>
                      <span className="subtle">{row.pushName ?? "One-off push"}</span>
                    </div>
                  </td>
                  <td className="subtle mono">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.items.length === 0 ? <p className="subtle" style={{ marginTop: 12 }}>No failed deliveries match these filters.</p> : null}
        </div>

        <Pagination basePath="/analytics/failures" currentParams={currentParams} page={page} pageSize={pageSize} total={result.total} />
      </section>
    </DashboardShell>
  );
}
