"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "../_components/toast";

type DeploymentAction = "minor-update" | "core-update";
type DeploymentMode = "docker" | "pm2";

type DeploymentResult = {
  action: DeploymentAction;
  mode: DeploymentMode;
  requestId: string | null;
  accepted: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

type DeploymentVersion = {
  mode: DeploymentMode;
  local: { commit: string | null; branch: string | null; dirty: boolean };
  github: { commit: string | null; branch: string | null };
  comparison: "up-to-date" | "behind" | "ahead" | "diverged" | "unknown";
  aheadBy: number | null;
  behindBy: number | null;
};

type DeploymentService = {
  name: string;
  status: string;
  health: string | null;
  image: string | null;
  startedAt: string | null;
};

type DeploymentStatus = {
  mode: DeploymentMode;
  state: "idle" | "queued" | "running" | "succeeded" | "failed" | "unavailable";
  requestId: string | null;
  action: DeploymentAction | null;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  services: DeploymentService[];
  logs: string;
};

const ACTIVE_REQUEST_STORAGE_KEY = "epe_active_deployment_request";
const STATUS_POLL_INTERVAL_MS = 5_000;
const STATUS_POLL_MAX_ATTEMPTS = 240;

function actionLabel(action: DeploymentAction): string {
  return action === "minor-update" ? "Minor Update" : "Core Update";
}

function actionDescription(action: DeploymentAction, mode: DeploymentMode): string {
  if (mode === "pm2") {
    return action === "minor-update"
      ? "Pull source and restart PM2 processes"
      : "Install dependencies, build, migrate, and restart PM2";
  }
  return action === "minor-update"
    ? "Fast-forward source, build with cache, migrate, and recreate application containers"
    : "Refresh base images, rebuild without cache, migrate, and recreate application containers";
}

function formatComparison(value: DeploymentVersion["comparison"]): string {
  if (value === "up-to-date") return "Up to date";
  if (value === "behind") return "Behind GitHub";
  if (value === "ahead") return "Ahead of GitHub";
  if (value === "diverged") return "Diverged";
  return "Unknown";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDeploymentStatus(): Promise<DeploymentStatus | null> {
  try {
    const response = await fetch("/api/dashboard/health/deployment/status", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { data?: DeploymentStatus } | null;
    return response.ok && payload?.data ? payload.data : null;
  } catch {
    return null;
  }
}

export function DeploymentActionsPanel() {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [result, setResult] = useState<DeploymentResult | null>(null);
  const [version, setVersion] = useState<DeploymentVersion | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);

  const loadVersion = useCallback(() => {
    setLoadingVersion(true);
    void fetch("/api/dashboard/health/deployment/version", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { data?: DeploymentVersion; error?: { message?: string } }
          | null;
        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? "Unable to load deployment version");
        }
        setVersion(payload.data);
      })
      .catch(() => setVersion(null))
      .finally(() => setLoadingVersion(false));
  }, []);

  const pollDeployment = useCallback(async (requestId: string) => {
    setIsUpdating(true);
    for (let attempt = 0; attempt < STATUS_POLL_MAX_ATTEMPTS; attempt += 1) {
      const status = await fetchDeploymentStatus();
      if (status) {
        setDeploymentStatus(status);
        if (status.requestId === requestId && status.state === "succeeded") {
          localStorage.removeItem(ACTIVE_REQUEST_STORAGE_KEY);
          setIsUpdating(false);
          toast.showSuccess("Docker update completed and all services passed validation.");
          loadVersion();
          router.refresh();
          return;
        }
        if (status.requestId === requestId && status.state === "failed") {
          localStorage.removeItem(ACTIVE_REQUEST_STORAGE_KEY);
          setIsUpdating(false);
          toast.showError(`Docker update failed: ${status.message}`);
          loadVersion();
          return;
        }
      }
      await sleep(STATUS_POLL_INTERVAL_MS);
    }
    setIsUpdating(false);
    toast.showError("The update is still unconfirmed after 20 minutes. Check the deployment status or host updater service.");
  }, [loadVersion, router, toast]);

  useEffect(() => {
    loadVersion();
    void fetchDeploymentStatus().then((status) => {
      if (status) setDeploymentStatus(status);
    });
    const activeRequest = localStorage.getItem(ACTIVE_REQUEST_STORAGE_KEY);
    if (activeRequest) void pollDeployment(activeRequest);
  }, [loadVersion, pollDeployment]);

  function run(action: DeploymentAction) {
    const mode = version?.mode ?? "docker";
    const confirmation = mode === "docker"
      ? action === "minor-update"
        ? "This will pull, build, migrate, and recreate the Docker application containers. Continue?"
        : "This will pull base images, rebuild without cache, migrate, and recreate the Docker application containers. Continue?"
      : action === "minor-update"
        ? "This will pull source and restart PM2. Continue?"
        : "This will reinstall dependencies, build, migrate, and restart PM2. Continue?";
    if (!window.confirm(confirmation)) return;

    setResult(null);
    startTransition(() => {
      void fetch("/api/dashboard/health/deployment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | { data?: DeploymentResult; error?: { message?: string; details?: string } }
            | null;
          if (!response.ok || !payload?.data) {
            const detail = payload?.error?.details ? ` ${payload.error.details}` : "";
            throw new Error(`${payload?.error?.message ?? `Unable to run ${actionLabel(action).toLowerCase()}`}${detail}`);
          }

          setResult(payload.data);
          if (payload.data.mode === "docker" && payload.data.requestId) {
            localStorage.setItem(ACTIVE_REQUEST_STORAGE_KEY, payload.data.requestId);
            toast.showSuccess(`${actionLabel(action)} queued on the Docker host.`);
            void pollDeployment(payload.data.requestId);
          } else {
            toast.showSuccess(`${actionLabel(action)} completed.`);
            loadVersion();
            router.refresh();
          }
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : `Unable to run ${actionLabel(action).toLowerCase()}.`);
        });
    });
  }

  const mode = version?.mode ?? deploymentStatus?.mode ?? "docker";

  return (
    <section className="card platform-health-deployment-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Deployment · {mode === "docker" ? "Docker Compose" : "PM2 fallback"}</p>
          <h3>Maintenance actions</h3>
        </div>
        <span className="badge warn">Super admin only</span>
      </div>

      <div className="grid cards-2" style={{ marginTop: 14 }}>
        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">Running version</p>
          {loadingVersion ? <p className="subtle">Checking deployed version...</p> : version ? (
            <>
              <p className="stat" style={{ marginBottom: 6 }}>{version.local.commit ?? "unknown"}</p>
              <p className="subtle">
                {version.local.branch ?? "branch unknown"}{version.local.dirty ? " · host checkout modified" : ""}
              </p>
            </>
          ) : <p className="subtle">Version status unavailable.</p>}
        </article>

        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">GitHub version</p>
          {loadingVersion ? <p className="subtle">Checking GitHub version...</p> : version ? (
            <>
              <p className="stat" style={{ marginBottom: 6 }}>{version.github.commit ?? "unknown"}</p>
              <p className="subtle">
                GitHub {version.github.branch ?? "main"} · {formatComparison(version.comparison)}
                {version.behindBy !== null || version.aheadBy !== null
                  ? ` (${version.behindBy ?? 0} behind, ${version.aheadBy ?? 0} ahead)` : ""}
              </p>
            </>
          ) : <p className="subtle">Version status unavailable.</p>}
        </article>
      </div>

      <p className="subtle">
        Docker updates are executed by the restricted host update agent. The API never receives access to the Docker socket.
      </p>

      <div className="grid cards-2" style={{ marginTop: 14 }}>
        {(["minor-update", "core-update"] as const).map((action) => (
          <article key={action} className="card" style={{ margin: 0 }}>
            <p className="eyebrow">{action === "minor-update" ? "Cached build" : "Clean rebuild"}</p>
            <p className="stat" style={{ marginBottom: 6 }}>{actionLabel(action)}</p>
            <p className="subtle">{actionDescription(action, mode)}</p>
            <button
              className="button primary"
              type="button"
              onClick={() => run(action)}
              disabled={isPending || isUpdating || deploymentStatus?.state === "unavailable"}
              style={{ marginTop: 12 }}
            >
              {isPending ? "Queueing..." : isUpdating ? "Updating..." : actionLabel(action)}
            </button>
          </article>
        ))}
      </div>

      {deploymentStatus ? (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Update status</p>
              <h3>{deploymentStatus.state}</h3>
              <p className="subtle">{deploymentStatus.message}</p>
            </div>
            <span className={`badge ${deploymentStatus.state === "succeeded" || deploymentStatus.state === "idle" ? "active" : "warn"}`}>
              {deploymentStatus.mode}
            </span>
          </div>
          {deploymentStatus.logs ? (
            <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: 320 }}>{deploymentStatus.logs}</pre>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <p className="subtle" style={{ marginTop: 14 }}>
          Request {result.requestId ?? "completed"} · {result.stdout || result.command}
        </p>
      ) : null}

      {deploymentStatus?.services.length ? (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <thead><tr><th>Service</th><th>Status</th><th>Health</th><th>Image</th><th>Started</th></tr></thead>
            <tbody>
              {deploymentStatus.services.map((service) => (
                <tr key={service.name}>
                  <td>{service.name}</td>
                  <td><span className={`badge ${service.status === "running" ? "active" : "warn"}`}>{service.status}</span></td>
                  <td className="subtle">{service.health ?? "—"}</td>
                  <td className="subtle">{service.image ?? "—"}</td>
                  <td className="subtle">{service.startedAt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
