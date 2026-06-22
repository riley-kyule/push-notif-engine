"use client";

import { useEffect, useState, useTransition } from "react";

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
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [message, setMessage] = useState<string | null>(
    connectedNotice
      ? `${PROVIDER_LABELS[connectedNotice as BackupProvider] ?? connectedNotice} connected.`
      : errorNotice
        ? `Connection failed (${errorNotice}). Please try again.`
        : null,
  );
  const [isPending, startTransition] = useTransition();

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
    setMessage(null);
    void fetch(`/api/dashboard/backup/${provider}/authorize`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: { authorizeUrl?: string } } | null;
        if (!response.ok || !payload?.data?.authorizeUrl) {
          throw new Error("Unable to start the connection");
        }

        window.location.href = payload.data.authorizeUrl;
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to start the connection"));
  }

  function handleDisconnect(provider: BackupProvider) {
    startTransition(() => {
      void fetch(`/api/dashboard/backup/${provider}`, { method: "DELETE" })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Unable to disconnect");
          }
          setMessage(`${PROVIDER_LABELS[provider]} disconnected.`);
          refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to disconnect"));
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
          refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to update the backup schedule"));
    });
  }

  function handleRunNow(provider: BackupProvider) {
    setMessage(null);
    startTransition(() => {
      void fetch(`/api/dashboard/backup/${provider}/run`, { method: "POST" })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.error?.message ?? "Unable to start the backup");
          }

          setMessage(`${PROVIDER_LABELS[provider]} backup started — check the history below for progress.`);
          refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to start the backup"));
    });
  }

  return (
    <>
      {message ? (
        <section className="card" style={{ marginTop: 18 }}>
          <p>{message}</p>
        </section>
      ) : null}

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
                        Next automatic backup: {new Date(provider.nextBackupDueAt).toLocaleString()}
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
        <h3>Backup history</h3>
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
                <span className="subtle">{new Date(run.startedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>What's included</h3>
        <p className="subtle">
          Each backup is a single archive containing a full PostgreSQL dump (sites, subscribers, campaigns, segments,
          automations, audit logs — everything needed to restore or migrate the system) plus every campaign media file.
          Deployment secrets (.env files, API keys) are intentionally excluded and must be recreated manually on a
          target server.
        </p>
      </section>
    </>
  );
}
