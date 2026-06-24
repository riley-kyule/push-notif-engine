"use client";

import { useEffect, useState, useTransition } from "react";

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

function actionLabel(action: DeploymentAction): string {
  return action === "minor-update" ? "Minor Update" : "Core Update";
}

function actionDescription(action: DeploymentAction): string {
  return action === "minor-update"
    ? "git pull, then restart PM2"
    : "npm install, build API and dashboard, migrate, then restart PM2";
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

export function DeploymentActionsPanel() {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [result, setResult] = useState<DeploymentResult | null>(null);
  const [version, setVersion] = useState<DeploymentVersion | null>(null);

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
          toast.showSuccess(`${actionLabel(action)} completed.`);
        })
        .catch((error) => {
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
            <button className="button primary" type="button" onClick={() => run(action)} disabled={isPending} style={{ marginTop: 12 }}>
              {isPending ? "Running..." : actionLabel(action)}
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
    </section>
  );
}
