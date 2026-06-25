"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "../_components/toast";

type DeploymentAction = "minor-update" | "core-update";

type DeploymentResult = {
  action: DeploymentAction;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

type DeploymentVersion = {
  local: { commit: string | null; branch: string | null; dirty: boolean };
  github: { commit: string | null; branch: string | null };
  comparison: "up-to-date" | "behind" | "ahead" | "diverged" | "unknown";
  aheadBy: number | null;
  behindBy: number | null;
};

type Pm2ProcessStatus = {
  name: string;
  pmId: number;
  pid: number | null;
  status: string;
  uptimeMs: number | null;
  restarts: number;
  cpu: number | null;
  memoryBytes: number | null;
};

const EXPECTED_PROCESS_NAMES = ["epe-api", "epe-worker", "epe-dashboard"];

// scripts/pm2-restart.sh deliberately delays the actual `pm2 restart` by 5
// seconds so it doesn't kill the very process (this API call) that's still
// sending the deployment response. Start polling a little past that, and
// keep retrying for a while -- the API/dashboard processes themselves go
// down and come back up during the restart, so early polls are expected to
// fail outright, not just report stale status.
const PM2_POLL_INITIAL_DELAY_MS = 7_000;
const PM2_POLL_INTERVAL_MS = 3_000;
const PM2_POLL_MAX_ATTEMPTS = 12;

function actionLabel(action: DeploymentAction): string {
  return action === "minor-update" ? "Minor Update" : "Core Update";
}

function actionDescription(action: DeploymentAction): string {
  return action === "minor-update"
    ? "git pull, then restart PM2"
    : "npm install, build API and dashboard, migrate, build worker, then restart PM2";
}

function formatComparison(value: DeploymentVersion["comparison"]): string {
  if (value === "up-to-date") {
    return "Up to date";
  }

  if (value === "behind") {
    return "Behind GitHub";
  }

  if (value === "ahead") {
    return "Ahead of GitHub";
  }

  if (value === "diverged") {
    return "Diverged";
  }

  return "Unknown";
}

function formatUptime(uptimeMs: number | null): string {
  if (uptimeMs === null) return "unknown uptime";
  const seconds = Math.floor(uptimeMs / 1000);
  if (seconds < 60) return `${seconds}s uptime`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m uptime`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m uptime`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPm2Status(): Promise<Pm2ProcessStatus[] | null> {
  try {
    const response = await fetch("/api/dashboard/health/deployment/pm2-status");
    const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: Pm2ProcessStatus[] } | null;
    if (!response.ok || !payload?.data) {
      return null;
    }
    return payload.data;
  } catch {
    return null;
  }
}

// Polls pm2 status until every process this deploy could have touched is
// reporting "online" with an uptime shorter than the time since the restart
// was scheduled (i.e. it actually restarted, not just "was already up"), or
// until attempts run out -- whichever comes first.
async function pollForRestartedProcesses(): Promise<{ processes: Pm2ProcessStatus[] | null; allOnline: boolean }> {
  await sleep(PM2_POLL_INITIAL_DELAY_MS);

  let lastResult: Pm2ProcessStatus[] | null = null;
  for (let attempt = 0; attempt < PM2_POLL_MAX_ATTEMPTS; attempt += 1) {
    const processes = await fetchPm2Status();
    if (processes) {
      lastResult = processes;
      const relevant = processes.filter((process) => EXPECTED_PROCESS_NAMES.includes(process.name));
      const allOnline = relevant.length > 0 && relevant.every((process) => process.status === "online");
      if (allOnline) {
        return { processes, allOnline: true };
      }
    }

    await sleep(PM2_POLL_INTERVAL_MS);
  }

  return { processes: lastResult, allOnline: false };
}

export function DeploymentActionsPanel() {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRestarting, setIsRestarting] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [result, setResult] = useState<DeploymentResult | null>(null);
  const [version, setVersion] = useState<DeploymentVersion | null>(null);
  const [pm2Status, setPm2Status] = useState<Pm2ProcessStatus[] | null>(null);

  useEffect(() => {
    void fetch("/api/dashboard/health/deployment/version")
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: DeploymentVersion; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? "Unable to load deployment version");
        }

        setVersion(payload.data);
      })
      .catch(() => {
        setVersion(null);
      })
      .finally(() => {
        setLoadingVersion(false);
      });
  }, []);

  function run(action: DeploymentAction) {
    if (
      !window.confirm(
        action === "minor-update"
          ? "This will git pull and restart PM2. Continue?"
          : "This will reinstall dependencies, build, migrate, and restart PM2. Continue?",
      )
    ) {
      return;
    }

    setResult(null);
    setPm2Status(null);
    startTransition(() => {
      void fetch("/api/dashboard/health/deployment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | { success?: boolean; data?: DeploymentResult; error?: { message?: string; details?: string } }
            | null;

          if (!response.ok || !payload?.data) {
            const detail = payload?.error?.details ? ` ${payload.error.details}` : "";
            throw new Error(`${payload?.error?.message ?? `Unable to run ${actionLabel(action).toLowerCase()}`}${detail}`);
          }

          setResult(payload.data);
          toast.showSuccess(`${actionLabel(action)} ran successfully. Waiting for PM2 to restart...`);

          setIsRestarting(true);
          const { processes, allOnline } = await pollForRestartedProcesses();
          setPm2Status(processes);
          setIsRestarting(false);

          if (allOnline) {
            toast.showSuccess(
              `${actionLabel(action)} completed — ${EXPECTED_PROCESS_NAMES.join(", ")} all online.`,
            );
          } else {
            toast.showError(
              `${actionLabel(action)} ran, but PM2 status couldn't be confirmed yet. Check the process list below or run "pm2 status" on the server.`,
            );
          }

          router.refresh();
        })
        .catch((error) => {
          setIsRestarting(false);
          toast.showError(error instanceof Error ? error.message : `Unable to run ${actionLabel(action).toLowerCase()}.`);
        });
    });
  }

  return (
    <section className="card platform-health-deployment-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Deployment</p>
          <h3>Maintenance actions</h3>
        </div>
        <span className="badge warn">Super admin only</span>
      </div>

      <div className="grid cards-2" style={{ marginTop: 14 }}>
        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">VM version</p>
          {loadingVersion ? (
            <p className="subtle">Checking local version...</p>
          ) : version ? (
            <>
              <p className="stat" style={{ marginBottom: 6 }}>
                {version.local.commit ?? "unknown"}
              </p>
              <p className="subtle">
                Local {version.local.branch ?? "branch unknown"}
                {version.local.dirty ? " · dirty working tree" : ""}
              </p>
            </>
          ) : (
            <p className="subtle">Version status unavailable.</p>
          )}
        </article>

        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">GitHub version</p>
          {loadingVersion ? (
            <p className="subtle">Checking GitHub version...</p>
          ) : version ? (
            <>
              <p className="stat" style={{ marginBottom: 6 }}>
                {version.github.commit ?? "unknown"}
              </p>
              <p className="subtle">
                GitHub {version.github.branch ?? "main"} · {formatComparison(version.comparison)}
                {version.behindBy !== null || version.aheadBy !== null
                  ? ` (${version.behindBy ?? 0} behind, ${version.aheadBy ?? 0} ahead)`
                  : ""}
              </p>
            </>
          ) : (
            <p className="subtle">Version status unavailable.</p>
          )}
        </article>
      </div>

      <p className="subtle">Use the smaller update for a code pull plus restart. Use the core update when dependencies or builds changed.</p>

      <div className="grid cards-2" style={{ marginTop: 14 }}>
        {(["minor-update", "core-update"] as const).map((action) => (
          <article key={action} className="card" style={{ margin: 0 }}>
            <p className="eyebrow">{action === "minor-update" ? "Quick sync" : "Full update"}</p>
            <p className="stat" style={{ marginBottom: 6 }}>
              {actionLabel(action)}
            </p>
            <p className="subtle">{actionDescription(action)}</p>
            <button className="button primary" type="button" onClick={() => run(action)} disabled={isPending || isRestarting} style={{ marginTop: 12 }}>
              {isPending ? "Running..." : isRestarting ? "Restarting..." : actionLabel(action)}
            </button>
          </article>
        ))}
      </div>

      {result ? (
        <pre
          className="card"
          style={{
            marginTop: 14,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
            background: "var(--surface)",
          }}
        >{`Command: ${result.command}
Exit code: ${result.exitCode ?? "unknown"}

STDOUT:
${result.stdout || "(empty)"}

STDERR:
${result.stderr || "(empty)"}`}</pre>
      ) : null}

      {isRestarting ? (
        <p className="subtle" style={{ marginTop: 14 }}>
          Waiting for PM2 to restart epe-api, epe-worker, and epe-dashboard...
        </p>
      ) : null}

      {pm2Status ? (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Status</th>
                <th>PID</th>
                <th>Uptime</th>
                <th>Restarts</th>
                <th>CPU</th>
                <th>Memory</th>
              </tr>
            </thead>
            <tbody>
              {pm2Status.map((process) => (
                <tr key={process.pmId}>
                  <td>{process.name}</td>
                  <td>
                    <span className={`badge ${process.status === "online" ? "active" : "warn"}`}>{process.status}</span>
                  </td>
                  <td className="subtle">{process.pid ?? "—"}</td>
                  <td className="subtle">{formatUptime(process.uptimeMs)}</td>
                  <td className="subtle">{process.restarts}</td>
                  <td className="subtle">{process.cpu === null ? "—" : `${process.cpu}%`}</td>
                  <td className="subtle">{process.memoryBytes === null ? "—" : `${Math.round(process.memoryBytes / (1024 * 1024))} MB`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
