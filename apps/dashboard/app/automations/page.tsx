import Link from "next/link";

import { PageSizeSelect, Pagination } from "../_components/list-controls";
import { DashboardShell } from "../_components/dashboard-shell";
import { fallbackSiteChoices, getSiteChoices } from "../_data/sites";
import { getFallbackAutomations, getAutomationSummaries } from "../_data/automations";
import { AutomationManager } from "./automation-manager";

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Number.parseInt(query.pageSize ?? "25", 10) || 25;
  const offset = (page - 1) * pageSize;

  const [sites, automationPage, activeAutomationCount] = await Promise.all([
    getSiteChoices().catch(() => fallbackSiteChoices),
    getAutomationSummaries({ limit: pageSize, offset }).catch(() => ({
      items: getFallbackAutomations(),
      total: getFallbackAutomations().length,
    })),
    getAutomationSummaries({ limit: 1, offset: 0, status: "active" }).catch(() => ({
      items: [],
      total: getFallbackAutomations().filter((automation) => automation.status === "active").length,
    })),
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
          <p className="stat">{automationPage.total.toLocaleString()}</p>
          <p className="subtle">Trigger-driven automations</p>
        </article>
        <article className="card">
          <p className="eyebrow">Active rules</p>
          <p className="stat">{activeAutomationCount.total.toLocaleString()}</p>
          <p className="subtle">Currently live automations</p>
        </article>
      </section>

      <div style={{ marginTop: 18 }}>
        <AutomationManager sites={sites} automations={automationPage.items} />
        <div style={{ marginTop: 14 }}>
          <div className="actions" style={{ justifyContent: "space-between", alignItems: "end", flexWrap: "wrap" }}>
            <PageSizeSelect basePath="/automations" currentParams={{ page: String(page) }} pageSize={pageSize} />
          </div>
          <Pagination basePath="/automations" currentParams={{ pageSize: String(pageSize) }} page={page} pageSize={pageSize} total={automationPage.total} />
        </div>
      </div>
    </DashboardShell>
  );
}
