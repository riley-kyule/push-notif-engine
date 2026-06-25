import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { getCampaignById, getCampaignList } from "../../_data/campaigns";

export default async function CampaignPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const query = await searchParams;
  const campaignsPayload = await getCampaignList();
  const selectedCampaign =
    (query.campaignId ? await getCampaignById(query.campaignId) : null) ??
    (campaignsPayload.items[0] ? await getCampaignById(campaignsPayload.items[0].id) : null);

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Campaign performance"
      description="Drill into one campaign's sent, delivered, clicked, and CTR figures."
      actions={
        <Link className="button secondary" href="/analytics">
          Back to analytics
        </Link>
      }
    >
      <section className="card analytics-panel analytics-report-main">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Campaign</p>
            <h3>{selectedCampaign?.name ?? "No campaign selected"}</h3>
          </div>
          <span className={`badge ${selectedCampaign?.status ?? "draft"}`}>{selectedCampaign?.status ?? "draft"}</span>
        </div>

        <form className="analytics-selectors analytics-selectors--stacked" action="/analytics/campaigns" method="get">
          <div className="field">
            <label htmlFor="analytics-campaign">Campaign</label>
            <select id="analytics-campaign" name="campaignId" className="select" defaultValue={selectedCampaign?.id ?? ""}>
              {campaignsPayload.items.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} - {campaign.status}
                </option>
              ))}
            </select>
          </div>
          <button className="button secondary" type="submit">
            View campaign
          </button>
        </form>

        {selectedCampaign ? (
          <div className="analytics-campaign-card">
            <p className="subtle">{selectedCampaign.site}</p>
            <p>{selectedCampaign.message}</p>
            <div className="analytics-mini-summary analytics-mini-summary--compact">
              <article className="analytics-mini-card">
                <span>Sent</span>
                <strong>{selectedCampaign.metrics.sent}</strong>
              </article>
              <article className="analytics-mini-card">
                <span>Delivered</span>
                <strong>{selectedCampaign.metrics.delivered}</strong>
              </article>
              <article className="analytics-mini-card">
                <span>Clicks</span>
                <strong>{selectedCampaign.metrics.clicks}</strong>
              </article>
              <article className="analytics-mini-card">
                <span>CTR</span>
                <strong>{selectedCampaign.metrics.ctr}</strong>
              </article>
            </div>
          </div>
        ) : (
          <p className="subtle">No campaigns yet -- create one to see its performance here.</p>
        )}
      </section>
    </DashboardShell>
  );
}
