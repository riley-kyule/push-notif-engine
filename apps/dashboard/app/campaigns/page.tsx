import Link from "next/link";

import { formatDisplayDateTimeInZone } from "../_components/format-date";
import { DashboardShell } from "../_components/dashboard-shell";
import { getCampaignList } from "../_data/campaigns";
import { getSiteChoices } from "../_data/sites";

const tabs = ["All", "Instant", "Scheduled", "Recurring", "Drafts"] as const;

// `campaign.scheduledAt` is either a real ISO timestamp (scheduled/recurring
// campaigns) or a literal label like "Draft"/"Sent today" when there's no
// concrete time to show -- only the former should go through the timezone
// formatter.
function formatScheduledAt(value: string, timeZone: string | null): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return formatDisplayDateTimeInZone(parsed, timeZone);
}

export default async function CampaignsPage() {
  const [campaigns, sites] = await Promise.all([getCampaignList(), getSiteChoices()]);
  const timezoneBySiteId = new Map(sites.map((site) => [site.id, site.timezone]));

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
        {tabs.map((tab, index) => (
          <span key={tab} className={`tab ${index === 0 ? "active" : ""}`}>
            {tab}
          </span>
        ))}
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Type</th>
                <th>Site</th>
                <th>Sent</th>
                <th>CTR</th>
                <th>Status</th>
                <th>Scheduled At (site local time)</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.items.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <Link href={`/campaigns/${campaign.id}`}>
                      <strong>{campaign.name}</strong>
                    </Link>
                  </td>
                  <td className="subtle">{campaign.type}</td>
                  <td>{campaign.site}</td>
                  <td>{campaign.sent}</td>
                  <td>{campaign.ctr}</td>
                  <td>
                    <span className={`badge ${campaign.status}`}>{campaign.status}</span>
                  </td>
                  <td className="subtle">
                    {formatScheduledAt(campaign.scheduledAt, campaign.siteId ? timezoneBySiteId.get(campaign.siteId) ?? null : null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
