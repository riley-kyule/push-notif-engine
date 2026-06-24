import { DashboardShell } from "../_components/dashboard-shell";
import { FilterSelect, PageSizeSelect, Pagination } from "../_components/list-controls";
import {
  describeAction,
  flattenMetadata,
  getActionCategory,
  getAuditLogPage,
  getCategoryLabel,
  getKnownCategories,
  getTargetTypeLabel,
  type AuditLogRow,
} from "../_data/audit-logs";

const ROLES = ["super-admin", "admin", "sub-admin", "customer-service", "editor", "analyst"] as const;
const DATE_PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
] as const;
const GROUP_BY_OPTIONS = [
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

  const activeFilterCount = [query.category, query.actorRole, query.date, query.groupBy].filter(Boolean).length;

  return (
    <DashboardShell
      eyebrow="System"
      title="Activity log"
      description="Track authentication, permissions, and operational changes across the platform, in plain language."
    >
      <section className="card audit-logs-panel">
        <details className="filter-panel">
          <summary className="button secondary">
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}
          </summary>
          <div className="grid cards-2" style={{ marginTop: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="category-filter" className="subtle">
                Activity
              </label>
              <FilterSelect
                basePath="/audit-logs"
                currentParams={currentParams}
                paramKey="category"
                allLabel="All activity"
                options={getKnownCategories().map((category) => ({ value: category, label: getCategoryLabel(category) }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="role-filter" className="subtle">
                Role
              </label>
              <FilterSelect
                basePath="/audit-logs"
                currentParams={currentParams}
                paramKey="actorRole"
                allLabel="All roles"
                options={ROLES.map((role) => ({ value: role, label: role }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="date-filter" className="subtle">
                Date
              </label>
              <FilterSelect
                basePath="/audit-logs"
                currentParams={currentParams}
                paramKey="date"
                allLabel="All time"
                options={DATE_PRESETS.map((entry) => ({ value: entry.key, label: entry.label }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="group-by-filter" className="subtle">
                Group by
              </label>
              <FilterSelect
                basePath="/audit-logs"
                currentParams={currentParams}
                paramKey="groupBy"
                allLabel="No grouping"
                options={GROUP_BY_OPTIONS.map((entry) => ({ value: entry.key, label: entry.label }))}
              />
            </div>
          </div>
        </details>

        <div className="report-toolbar" style={{ marginTop: 14 }}>
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
                    <th>What happened</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const details = flattenMetadata(row.metadata);
                    return (
                      <tr key={row.id}>
                        <td className="subtle">{formatTimestamp(row.createdAt)}</td>
                        <td>
                          <div className="stack-tight">
                            <strong>{describeAction(row)}</strong>
                            <span className="subtle">
                              {row.actorEmail ?? "No actor"} · {row.actorRole ?? "system"}
                            </span>
                          </div>
                        </td>
                        <td className="subtle">{getTargetTypeLabel(row.targetType)}</td>
                        <td>
                          {details.length === 0 ? (
                            <span className="subtle">—</span>
                          ) : (
                            <dl className="audit-details-list">
                              {details.map((detail) => (
                                <div key={detail.label} className="audit-details-row">
                                  <dt>{detail.label}</dt>
                                  <dd>{detail.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
