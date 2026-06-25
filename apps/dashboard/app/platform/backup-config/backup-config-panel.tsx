"use client";

import { useEffect, useState, useTransition } from "react";

import { formatDisplayDate, formatDisplayDateTime } from "../../_components/format-date";
import { useToast } from "../../_components/toast";

type BackupProvider = "dropbox" | "google_drive";

interface ProviderStatus {
  provider: BackupProvider;
  configured: boolean;
  connected: boolean;
  accountLabel: string | null;
  autoBackupEnabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  nextBackupDueAt: string | null;
}

interface BackupRun {
  id: string;
  provider: BackupProvider;
  status: "running" | "completed" | "failed";
  trigger: "manual" | "scheduled";
  fileName: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

const PROVIDER_LABELS: Record<BackupProvider, string> = {
  dropbox: "Dropbox",
  google_drive: "Google Drive",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function BackupConfigPanel({
  connectedNotice,
  errorNotice,
}: {
  connectedNotice?: string | undefined;
  errorNotice?: string | undefined;
}) {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (connectedNotice) {
      toast.showSuccess(`${PROVIDER_LABELS[connectedNotice as BackupProvider] ?? connectedNotice} connected.`);
    } else if (errorNotice) {
      toast.showError(`Connection failed (${errorNotice}). Please try again.`);
    }
    // Only fire once for the redirect-driven notice this component mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    void fetch("/api/dashboard/backup")
      .then((response) => response.json())
      .then((payload: { data?: ProviderStatus[] }) => setProviders(payload.data ?? []))
      .catch(() => setProviders([]));

    void fetch("/api/dashboard/backup/runs")
      .then((response) => response.json())
      .then((payload: { data?: BackupRun[] }) => setRuns(payload.data ?? []))
      .catch(() => setRuns([]));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, []);

  function handleConnect(provider: BackupProvider) {
    void fetch(`/api/dashboard/backup/${provider}/authorize`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: { authorizeUrl?: string } } | null;
        if (!response.ok || !payload?.data?.authorizeUrl) {
          throw new Error("Unable to start the connection");
        }

        window.location.href = payload.data.authorizeUrl;
      })
      .catch((error) => toast.showError(error instanceof Error ? error.message : "Unable to start the connection."));
  }

  function handleDisconnect(provider: BackupProvider) {
    startTransition(() => {
      void fetch(`/api/dashboard/backup/${provider}`, { method: "DELETE" })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Unable to disconnect");
          }
          toast.showSuccess(`${PROVIDER_LABELS[provider]} disconnected.`);
          refresh();
        })
        .catch((error) => toast.showError(error instanceof Error ? error.message : "Unable to disconnect."));
    });
  }

  function handleScheduleChange(provider: BackupProvider, enabled: boolean, frequency: "daily" | "weekly" | "monthly") {
    startTransition(() => {
      void fetch(`/api/dashboard/backup/${provider}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, frequency }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Unable to update the backup schedule");
          }
          toast.showSuccess(`${PROVIDER_LABELS[provider]} backup schedule updated.`);
          refresh();
        })
        .catch((error) => toast.showError(error instanceof Error ? error.message : "Unable to update the backup schedule."));
    });
  }

  function handleRunNow(provider: BackupProvider) {
    startTransition(() => {
      void fetch(`/api/dashboard/backup/${provider}/run`, { method: "POST" })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.error?.message ?? "Unable to start the backup");
          }

          toast.showSuccess(`${PROVIDER_LABELS[provider]} backup started — check the history below for progress.`);
          refresh();
        })
      .catch((error) => toast.showError(error instanceof Error ? error.message : "Unable to start the backup."));
    });
  }

  const connectedProviders = (providers ?? []).filter((provider) => provider.connected);
  const activeSchedules = connectedProviders.filter((provider) => provider.autoBackupEnabled).length;
  const latestSuccessfulRun = [...runs].find((run) => run.status === "completed");

  async function handleCopyRestoreCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopyStatus("Restore command copied.");
      window.setTimeout(() => setCopyStatus(null), 1800);
    } catch {
      setCopyStatus("Copying failed. Select the command manually.");
    }
  }

  function buildRestoreCommand(run: BackupRun | null | undefined): string {
    const fileName = run?.fileName ?? "epe-backup-latest.tar.gz";
    return [
      "# Restore the latest EPE backup archive",
      `tar -xzf ${fileName}`,
      'pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" database.dump',
      "# Restore campaign media files from the extracted media/ directory",
    ].join("\n");
  }

  return (
    <>
      <section className="grid cards-3" style={{ marginTop: 18 }}>
        <article className="card backup-summary-card">
          <p className="subtle">Connected providers</p>
          <p className="stat">{connectedProviders.length}</p>
        </article>
        <article className="card backup-summary-card">
          <p className="subtle">Automatic schedules</p>
          <p className="stat">{activeSchedules}</p>
        </article>
        <article className="card backup-summary-card">
          <p className="subtle">Latest successful backup</p>
          <p className="stat">{latestSuccessfulRun ? formatDisplayDate(latestSuccessfulRun.startedAt) : "—"}</p>
        </article>
      </section>

      <section className="grid cards-2" style={{ marginTop: 18 }}>
        {(providers ?? []).map((provider) => (
          <article key={provider.provider} className="card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{PROVIDER_LABELS[provider.provider]}</p>
                <h3>{provider.connected ? provider.accountLabel ?? "Connected" : "Not connected"}</h3>
              </div>
              <span className={`badge ${provider.connected ? "active" : "inactive"}`}>
                {provider.connected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {!provider.configured ? (
              <p className="subtle" style={{ marginTop: 12 }}>
                Not configured on the server — an admin needs to set the{" "}
                {provider.provider === "dropbox" ? "DROPBOX_APP_KEY / DROPBOX_APP_SECRET" : "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET"}{" "}
                environment variables before this can be connected.
              </p>
            ) : (
              <>
                <div className="actions" style={{ marginTop: 12 }}>
                  {provider.connected ? (
                    <>
                      <button className="button secondary" type="button" disabled={isPending} onClick={() => handleDisconnect(provider.provider)}>
                        Disconnect
                      </button>
                      <button className="button primary" type="button" disabled={isPending} onClick={() => handleRunNow(provider.provider)}>
                        Run backup now
                      </button>
                    </>
                  ) : (
                    <button className="button primary" type="button" disabled={isPending} onClick={() => handleConnect(provider.provider)}>
                      Connect {PROVIDER_LABELS[provider.provider]}
                    </button>
                  )}
                </div>

                {provider.connected ? (
                  <div style={{ marginTop: 16 }}>
                    <label className="subtle" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={provider.autoBackupEnabled}
                        disabled={isPending}
                        onChange={(event) => handleScheduleChange(provider.provider, event.target.checked, provider.frequency)}
                      />
                      Automatic backups
                    </label>

                    {provider.autoBackupEnabled ? (
                      <select
                        className="input"
                        style={{ marginTop: 8 }}
                        value={provider.frequency}
                        disabled={isPending}
                        onChange={(event) =>
                          handleScheduleChange(provider.provider, true, event.target.value as "daily" | "weekly" | "monthly")
                        }
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    ) : null}

                    {provider.nextBackupDueAt ? (
                      <p className="subtle" style={{ marginTop: 8 }}>
                        Next automatic backup: {formatDisplayDateTime(provider.nextBackupDueAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </article>
        ))}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Backup history</p>
            <h3>Recent runs and outcomes</h3>
          </div>
          <span className="badge active">{runs.length} recorded</span>
        </div>
        {runs.length === 0 ? (
          <p className="subtle">No backups have run yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {runs.map((run) => (
              <div key={run.id} className="backup-run-row">
                <span>{PROVIDER_LABELS[run.provider]}</span>
                <span className={`badge ${run.status === "completed" ? "active" : run.status === "failed" ? "failed" : "pending"}`}>
                  {run.status}
                </span>
                <span className="subtle">{run.trigger}</span>
                <span className="mono subtle">{run.errorMessage ?? run.fileName ?? "—"}</span>
                <span className="subtle">{formatBytes(run.sizeBytes)}</span>
                <span className="subtle">{formatDisplayDateTime(run.startedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid cards-2" style={{ marginTop: 18 }}>
        <section className="card backup-restore-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Restore toolkit</p>
              <h3>Manual recovery steps</h3>
            </div>
            <span className="badge">Server-side</span>
          </div>

          <p className="subtle">
            EPE keeps the recovery workflow explicit: restore the database with `pg_restore`, then rehydrate media
            objects. Secrets and environment files are intentionally not included.
          </p>

          <pre className="backup-command"><code>{buildRestoreCommand(latestSuccessfulRun)}</code></pre>

          <div className="actions">
            <button className="button secondary" type="button" onClick={() => void handleCopyRestoreCommand(buildRestoreCommand(latestSuccessfulRun))}>
              Copy restore command
            </button>
            {copyStatus ? <span className="subtle">{copyStatus}</span> : null}
          </div>
        </section>

        <section className="card backup-restore-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Archive contents</p>
              <h3>What every backup includes</h3>
            </div>
          </div>
          <ul className="backup-checklist">
            <li>Full PostgreSQL dump of sites, subscribers, campaigns, segments, automations, audits, and backup metadata</li>
            <li>All campaign media objects stored under their original object keys</li>
            <li>Manifest with archive timestamp and media count for recovery validation</li>
            <li>Excludes `.env` files, API keys, and other deployment secrets</li>
          </ul>
          <p className="subtle">
            Use the latest completed run as the recovery starting point. If a provider is disconnected, reconnect it
            before scheduling the next backup.
          </p>
        </section>
      </section>
    </>
  );
}
