import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getCampaignTaxonomies } from "../_data/campaign-taxonomies";
import { CampaignTaxonomiesManager } from "./campaign-taxonomies-manager";

export default async function CampaignTaxonomiesPage() {
  const taxonomies = await getCampaignTaxonomies();

  return (
    <DashboardShell
      eyebrow="Campaign Taxonomies"
      title="Manage content taxonomy"
      description="Define the controlled content labels used by campaign creation, reporting, and CRM attribution."
      actions={
        <Link className="button secondary" href="/campaigns/new">
          Back to builder
        </Link>
      }
    >
      <CampaignTaxonomiesManager initialTaxonomies={taxonomies} />
    </DashboardShell>
  );
}
