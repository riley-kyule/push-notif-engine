import { notFound } from "next/navigation";

import { DashboardShell } from "../../_components/dashboard-shell";
import { campaignDetails, getCampaignById } from "../../_data/campaigns";
import { CampaignActions } from "./campaign-actions";

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return Object.keys(campaignDetails).map((id) => ({ id }));
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = (await getCampaignById(id)) ?? campaignDetails[id];
  if (!campaign) {
    notFound();
  }

  return (
    <DashboardShell
      eyebrow="Campaign Detail"
      title={campaign.name}
      description="Review campaign performance, timeline events, and delivery readiness."
    >
      <section className="grid cards-4">
        {Object.entries(campaign.metrics).map(([label, value]) => (
          <article className="card" key={label}>
            <h3>{label}</h3>
            <p className="stat">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid" style={{ gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)", marginTop: 18 }}>
        <article className="card">
          <h3>Campaign content</h3>
          <p className="subtle">Title</p>
          <p>{campaign.title}</p>
          <p className="subtle">Message</p>
          <p>{campaign.message}</p>
          <p className="subtle">URL</p>
          <p>{campaign.url}</p>
          <p className="subtle">Buttons</p>
          <ul>
            {campaign.buttons.map((button) => (
              <li key={button.label}>
                {button.label} - {button.url}
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h3>Timeline</h3>
          <div className="grid" style={{ gap: 12 }}>
            {campaign.timeline.map((item) => (
              <div key={item.label} className={`badge ${item.tone === "neutral" ? "draft" : item.tone}`}>
                {item.label}: {item.value}
              </div>
            ))}
          </div>
        </article>
      </section>

      <CampaignActions campaignId={campaign.id} initialName={campaign.name} />
    </DashboardShell>
  );
}
