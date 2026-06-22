import { DashboardShell } from "../../_components/dashboard-shell";
import { getCampaignTaxonomyChoices } from "../../_data/campaign-taxonomies";
import { getSegmentChoices } from "../../_data/segments";
import { getSiteChoices } from "../../_data/sites";
import { CampaignBuilderForm } from "./campaign-builder-form";

export default async function NewCampaignPage() {
  const [sites, segments, taxonomies] = await Promise.all([getSiteChoices(), getSegmentChoices(), getCampaignTaxonomyChoices()]);

  return (
    <DashboardShell
      eyebrow="Campaign Builder"
      title="Create campaign"
      description="Draft the message, choose the audience, schedule delivery, and verify the preview before launch."
    >
      <CampaignBuilderForm sites={sites} segments={segments} taxonomies={taxonomies} />
    </DashboardShell>
  );
}
