import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { fallbackSiteChoices, getSiteChoices } from "../_data/sites";
import { getFallbackAutomations, getAutomationSummaries } from "../_data/automations";
import { AutomationManager } from "./automation-manager";

export default async function AutomationsPage() {
  const [sites, automations] = await Promise.all([
    getSiteChoices().catch(() => fallbackSiteChoices),
    getAutomationSummaries().catch(() => getFallbackAutomations()),
  ]);

  return (
    <DashboardShell
      eyebrow="Automation"
      title="Automation rules"
      description="Manage trigger-driven notification, tagging, and webhook rules across Exotic sites."
      actions={
        <>
          <Link className="button secondary" href="/workflow">
            Workflow
          </Link>
          <Link className="button primary" href="/segments">
            Segments
          </Link>
        </>
      }
    >
      <section className="grid cards-3">
        <article className="card">
          <p className="eyebrow">Sites</p>
          <p className="stat">{sites.length}</p>
          <p className="subtle">Configured Exotic properties</p>
        </article>
        <article className="card">
          <p className="eyebrow">Rules</p>
          <p className="stat">{automations.length}</p>
          <p className="subtle">Trigger-driven automations</p>
        </article>
        <article className="card">
          <p className="eyebrow">Active rules</p>
          <p className="stat">{automations.filter((automation) => automation.status === "active").length}</p>
          <p className="subtle">Currently live automations</p>
        </article>
      </section>

      <div style={{ marginTop: 18 }}>
        <AutomationManager sites={sites} automations={automations} />
      </div>
    </DashboardShell>
  );
}
