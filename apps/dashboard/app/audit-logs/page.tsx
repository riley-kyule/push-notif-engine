import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { buildHref } from "../_components/list-controls.utils";
import { PageSizeSelect, Pagination } from "../_components/list-controls";
import {
  describeAction,
  getActionCategory,
  getAuditLogPage,
  getCategoryLabel,
  getKnownCategories,
  type AuditLogRow,
} from "../_data/audit-logs";

const ROLES = ["super-admin", "admin", "sub-admin", "customer-service", "editor", "analyst"] as const;
const DATE_PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
] as const;
const GROUP_BY_OPTIONS = [
  { key: "", label: "No grouping" },
  { key: "category", label: "Activity" },
  { key: "actorRole", label: "Role" },
  { key: "actor", label: "User" },
  { key: "date", label: "Date" },
] as const;

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function groupKeyFor(row: AuditLogRow, groupBy: string): string {
  switch (groupBy) {
    case "category":
      return getCategoryLabel(getActionCategory(row.action));
    case "actorRole":
      return row.actorRole ?? "system";
    case "actor":
      return row.actorName ?? row.actorEmail ?? "System";
    case "date":
      return formatDateOnly(row.createdAt);
    default:
      return "";
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    actorRole?: string;
    date?: string;
    groupBy?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Number.parseInt(query.pageSize ?? "25", 10) || 25;
  const preset = DATE_PRESETS.find((entry) => entry.key === query.date);
  const createdAfter = preset ? new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000).toISOString() : undefined;
  const groupBy = GROUP_BY_OPTIONS.some((entry) => entry.key === query.groupBy) ? query.groupBy ?? "" : "";

  const result = await getAuditLogPage({
    category: query.category,
    actorRole: query.actorRole,
    createdAfter,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const currentParams = {
    category: query.category,
    actorRole: query.actorRole,
    date: query.date,
    groupBy: query.groupBy,
    pageSize: String(pageSize),
  };

  const groups = new Map<string, AuditLogRow[]>();
  if (groupBy) {
    for (const row of result.items) {
      const key = groupKeyFor(row, groupBy);
      const existing = groups.get(key) ?? [];
      existing.push(row);
      groups.set(key, existing);
    }
  } else {
    groups.set("", result.items);
  }

  return (
    <DashboardShell
      eyebrow="System"
      title="Activity log"
      description="Track authentication, permissions, and operational changes across the platform, in plain language."
    >
      <section className="card audit-logs-panel">
        <div className="grid cards-2" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Activity</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              <Link
                href={buildHref("/audit-logs", { ...currentParams, category: undefined, page: "1" })}
                className={`button secondary ${!query.category ? "is-disabled" : ""}`}
              >
                All activity
              </Link>
              {getKnownCategories().map((category) => (
                <Link
                  key={category}
                  href={buildHref("/audit-logs", { ...currentParams, category, page: "1" })}
                  className={`button secondary ${query.category === category ? "is-disabled" : ""}`}
                >
                  {getCategoryLabel(category)}
                </Link>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Role</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              <Link
                href={buildHref("/audit-logs", { ...currentParams, actorRole: undefined, page: "1" })}
                className={`button secondary ${!query.actorRole ? "is-disabled" : ""}`}
              >
                All roles
              </Link>
              {ROLES.map((role) => (
                <Link
                  key={role}
                  href={buildHref("/audit-logs", { ...currentParams, actorRole: role, page: "1" })}
                  className={`button secondary ${query.actorRole === role ? "is-disabled" : ""}`}
                >
                  {role}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid cards-2" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Date</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              <Link
                href={buildHref("/audit-logs", { ...currentParams, date: undefined, page: "1" })}
                className={`button secondary ${!query.date ? "is-disabled" : ""}`}
              >
                All time
              </Link>
              {DATE_PRESETS.map((entry) => (
                <Link
                  key={entry.key}
                  href={buildHref("/audit-logs", { ...currentParams, date: entry.key, page: "1" })}
                  className={`button secondary ${query.date === entry.key ? "is-disabled" : ""}`}
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Group by</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              {GROUP_BY_OPTIONS.map((entry) => (
                <Link
                  key={entry.label}
                  href={buildHref("/audit-logs", { ...currentParams, groupBy: entry.key || undefined, page: "1" })}
                  className={`button secondary ${groupBy === entry.key ? "is-disabled" : ""}`}
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="report-toolbar">
          <div>
            <strong>{result.total.toLocaleString()} events</strong>
            <span>Most recent first</span>
          </div>
          <PageSizeSelect basePath="/audit-logs" currentParams={currentParams} pageSize={pageSize} />
        </div>

        {Array.from(groups.entries()).map(([groupLabel, rows]) => (
          <div key={groupLabel || "all"} style={{ marginTop: 18 }}>
            {groupLabel ? (
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                {groupLabel} ({rows.length})
              </p>
            ) : null}
            <div className="audit-logs-table-wrap">
              <table className="audit-logs-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Activity</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="subtle">{formatTimestamp(row.createdAt)}</td>
                      <td>
                        <div className="stack-tight">
                          <strong>{describeAction(row)}</strong>
                          <span className="subtle">{row.actorEmail ?? "No actor"} · {row.actorRole ?? "system"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stack-tight">
                          <span>{row.targetType ?? "—"}</span>
                          <span className="subtle mono">{row.targetId ?? "—"}</span>
                        </div>
                      </td>
                      <td>
                        <pre className="audit-metadata">{JSON.stringify(row.metadata, null, 2)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <Pagination basePath="/audit-logs" currentParams={currentParams} page={page} pageSize={pageSize} total={result.total} />
      </section>
    </DashboardShell>
  );
}
