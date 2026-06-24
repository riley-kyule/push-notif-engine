import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getSiteList } from "./sites.utils";
import { SitesTable } from "./sites-table";

export default async function SitesPage() {
  const sites = await getSiteList();

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
      <SitesTable sites={sites.items} />
    </DashboardShell>
  );
}
