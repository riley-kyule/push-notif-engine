import Link from "next/link";

import { formatDisplayDateTimeInZone } from "../_components/format-date";
import { SortableHeader } from "../_components/list-controls";
import type { CampaignSummary } from "../_data/campaigns";

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

export function CampaignsTable({
  campaigns,
  siteNames,
  timezoneBySiteId,
  basePath,
  currentParams,
}: {
  campaigns: CampaignSummary[];
  siteNames: Record<string, string>;
  timezoneBySiteId: Map<string, string | null>;
  basePath: string;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <SortableHeader basePath={basePath} currentParams={currentParams} field="name" label="Campaign" />
            <SortableHeader basePath={basePath} currentParams={currentParams} field="type" label="Type" />
            <th>Site</th>
            <th>Sent</th>
            <th>CTR</th>
            <SortableHeader basePath={basePath} currentParams={currentParams} field="status" label="Status" />
            <SortableHeader basePath={basePath} currentParams={currentParams} field="scheduledAt" label="Scheduled At (site local time)" />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>
                <Link href={`/campaigns/${campaign.id}`}>
                  <strong>{campaign.name}</strong>
                </Link>
              </td>
              <td className="subtle">{campaign.type}</td>
              <td className="subtle">{campaign.siteId ? siteNames[campaign.siteId] ?? campaign.site : "All sites"}</td>
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
          {campaigns.length === 0 ? (
            <tr>
              <td colSpan={7} className="subtle">
                No campaigns match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
