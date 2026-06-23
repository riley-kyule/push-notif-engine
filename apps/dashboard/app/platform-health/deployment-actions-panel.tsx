"use client";

import { useState, useTransition } from "react";

type DeploymentAction = "update" | "restart";

type DeploymentResult = {
  action: DeploymentAction;
  command: string;
  stdout: string;
  stderr: string;
};

function actionLabel(action: DeploymentAction): string {
  return action === "update" ? "Run update" : "Restart PM2";
}

function actionDescription(action: DeploymentAction): string {
  return action === "update"
    ? "git pull, npm install, build API and dashboard, migrate, then restart PM2"
    : "restart the PM2 process set without pulling code or rebuilding";
}

export function DeploymentActionsPanel() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DeploymentResult | null>(null);

  function run(action: DeploymentAction) {
    if (!window.confirm(`This will ${action === "update" ? "pull updates, rebuild, migrate, and restart processes" : "restart PM2"}. Continue?`)) {
      return;
    }

    setMessage(null);
    setResult(null);
    startTransition(() => {
      void fetch("/api/dashboard/health/deployment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | { success?: boolean; data?: DeploymentResult; error?: { message?: string } }
            | null;

          if (!response.ok || !payload?.data) {
            throw new Error(payload?.error?.message ?? `Unable to ${action} platform`);
          }

          setResult(payload.data);
          setMessage(`${actionLabel(action)} completed.`);
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : `Unable to ${action} platform`);
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

      <p className="subtle">
        These actions run the same update sequence you currently type in the terminal, from the dashboard itself.
      </p>

      <div className="grid cards-2" style={{ marginTop: 14 }}>
        {(["update", "restart"] as const).map((action) => (
          <article key={action} className="card" style={{ margin: 0 }}>
            <p className="eyebrow">{action === "update" ? "Full update" : "Process restart"}</p>
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

      {message ? <p className="badge neutral" style={{ marginTop: 14, justifyContent: "flex-start" }}>{message}</p> : null}

      {result ? (
        <pre
          className="card"
          style={{
            marginTop: 14,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
            background: "var(--surface)",
          }}
        >
{`Command: ${result.command}

STDOUT:
${result.stdout || "(empty)"}

STDERR:
${result.stderr || "(empty)"}`}
        </pre>
      ) : null}
    </section>
  );
}
