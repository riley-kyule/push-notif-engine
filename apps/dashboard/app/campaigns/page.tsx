import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { FilterSelect, PageSizeSelect, Pagination } from "../_components/list-controls";
import { getCampaignList, type CampaignSortField } from "../_data/campaigns";
import { fallbackSiteChoices, getSiteChoices } from "../_data/sites";
import { CampaignsTable } from "./campaigns-table";

const typeTabs = [
  { value: undefined, label: "All" },
  { value: "instant", label: "Instant" },
  { value: "scheduled", label: "Scheduled" },
  { value: "recurring", label: "Recurring" },
  { value: "draft", label: "Drafts" },
] as const;

const SORT_FIELDS = ["name", "type", "status", "scheduledAt", "sentAt", "createdAt"] as const;

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    siteId?: string;
    page?: string;
    pageSize?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}) {
  const query = await searchParams;
  const activeTab = typeTabs.find((tab) => tab.value === query.type) ?? typeTabs[0];
  // "Drafts" is a status, not a campaign type -- the rest of the tabs map
  // straight onto the type filter.
  const type = activeTab.value && activeTab.value !== "draft" ? activeTab.value : undefined;
  const status = activeTab.value === "draft" ? "draft" : undefined;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Number.parseInt(query.pageSize ?? "25", 10) || 25;
  const sortBy = (SORT_FIELDS as readonly string[]).includes(query.sortBy ?? "")
    ? (query.sortBy as CampaignSortField)
    : undefined;
  const sortDir = query.sortDir === "asc" ? "asc" : query.sortDir === "desc" ? "desc" : undefined;

  const [campaigns, sites] = await Promise.all([
    getCampaignList({
      siteId: query.siteId,
      type,
      status,
      sortBy,
      sortDir,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getSiteChoices().catch(() => fallbackSiteChoices),
  ]);

  const realSites = sites.filter((site) => site.id !== "site-3");
  const siteNames = Object.fromEntries(sites.map((site) => [site.id, site.name]));
  const timezoneBySiteId = new Map(sites.map((site) => [site.id, site.timezone]));
  const currentParams = {
    type: query.type,
    siteId: query.siteId,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    pageSize: String(pageSize),
  };

  return (
    <DashboardShell
      eyebrow="Campaigns"
      title="Campaign list"
      description="Manage drafts, scheduled sends, recurring messages, and live campaign performance."
      actions={
        <Link className="button primary" href="/campaigns/new">
          Create Campaign
        </Link>
      }
    >
      <div className="tabs" aria-label="Campaign filters">
        {typeTabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.value ? `/campaigns?type=${tab.value}` : "/campaigns"}
            className={`tab ${activeTab.value === tab.value ? "active" : ""}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <section className="card">
        <div className="grid cards-3" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="site-filter" className="subtle">
              Site
            </label>
            <FilterSelect
              basePath="/campaigns"
              currentParams={currentParams}
              paramKey="siteId"
              allLabel="All Sites"
              options={realSites.map((site) => ({ value: site.id, label: site.name }))}
            />
          </div>
          <PageSizeSelect basePath="/campaigns" currentParams={currentParams} pageSize={pageSize} />
        </div>

        <CampaignsTable
          campaigns={campaigns.items}
          siteNames={siteNames}
          timezoneBySiteId={timezoneBySiteId}
          basePath="/campaigns"
          currentParams={currentParams}
        />

        <Pagination basePath="/campaigns" currentParams={currentParams} page={page} pageSize={pageSize} total={campaigns.total} />
      </section>
    </DashboardShell>
  );
}
