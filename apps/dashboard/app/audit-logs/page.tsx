import { apiJson } from "../../lib/server-api";
import { DashboardShell } from "../_components/dashboard-shell";

interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface AuditLogPage {
  items: AuditLogRow[];
  total: number;
  limit: number;
  offset: number;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AuditLogsPage() {
  const page = (await apiJson<{
    success?: boolean;
    data?: AuditLogPage;
  }>("/audit-logs?limit=25&offset=0"))?.data ?? { items: [], total: 0, limit: 25, offset: 0 };

  return (
    <DashboardShell
      eyebrow="Audit"
      title="Audit logs"
      description="Track authentication, permissions, and operational changes across the platform."
    >
      <section className="card audit-logs-panel">
        <div className="report-toolbar">
          <div>
            <strong>{page.total.toLocaleString()} events</strong>
            <span>Most recent first</span>
          </div>
          <div className="report-toolbar-pill">Limit {page.limit}</div>
        </div>

        <div className="audit-logs-table-wrap">
          <table className="audit-logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
                <tr key={row.id}>
                  <td>{formatTimestamp(row.createdAt)}</td>
                  <td>
                    <div className="stack-tight">
                      <strong>{row.actorName ?? "System"}</strong>
                      <span>{row.actorEmail ?? "No actor"}</span>
                      <span>{row.actorRole ?? "system"}</span>
                    </div>
                  </td>
                  <td>
                    <code className="audit-action">{row.action}</code>
                  </td>
                  <td>
                    <div className="stack-tight">
                      <span>{row.targetType ?? "—"}</span>
                      <span>{row.targetId ?? "—"}</span>
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
      </section>
    </DashboardShell>
  );
}
