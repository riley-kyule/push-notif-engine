import { DashboardShell } from "../../_components/dashboard-shell";
import { getSiteChoices } from "../../_data/sites";
import { CampaignBuilderForm } from "./campaign-builder-form";

export default async function NewCampaignPage() {
  const sites = await getSiteChoices();

  return (
    <DashboardShell
      eyebrow="Campaign Builder"
      title="Create campaign"
      description="Draft the message, choose the audience, schedule delivery, and verify the preview before launch."
    >
      <CampaignBuilderForm sites={sites} />
    </DashboardShell>
  );
}
