import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { PageSizeSelect, Pagination, SearchBox } from "../_components/list-controls";
import { getSiteList, type SiteListFilters } from "./sites.utils";
import { SitesTable } from "./sites-table";

const SORT_FIELDS = ["name", "createdAt", "subscriberCount", "connection", "country"] as const;

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; sortBy?: string; sortDir?: string }>;
}) {
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Number.parseInt(query.pageSize ?? "25", 10) || 25;
  const sortBy = (SORT_FIELDS as readonly string[]).includes(query.sortBy ?? "")
    ? (query.sortBy as SiteListFilters["sortBy"])
    : undefined;
  const sortDir = query.sortDir === "asc" ? "asc" : query.sortDir === "desc" ? "desc" : undefined;

  const sites = await getSiteList({
    search: query.search,
    sortBy,
    sortDir,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const currentParams = { search: query.search, sortBy: query.sortBy, sortDir: query.sortDir, pageSize: String(pageSize) };

  return (
    <DashboardShell
      eyebrow="Sites"
      title="Site management"
      description="Manage Exotic websites, push credentials, and per-site integration status."
      actions={
        <Link className="button primary" href="/sites/new">
          Add Site
        </Link>
      }
      >
      <section className="card">
        <div className="actions" style={{ justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <div style={{ maxWidth: 360, flex: "1 1 260px" }}>
            <SearchBox basePath="/sites" currentParams={currentParams} placeholder="Search by name, URL, platform, or country" />
          </div>
          <PageSizeSelect basePath="/sites" currentParams={currentParams} pageSize={pageSize} />
        </div>

        <SitesTable sites={sites.items} basePath="/sites" currentParams={currentParams} />

        <Pagination basePath="/sites" currentParams={currentParams} page={page} pageSize={pageSize} total={sites.total} />
      </section>
    </DashboardShell>
  );
}
