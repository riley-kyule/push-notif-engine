import Link from "next/link";

import { formatDisplayDate } from "../_components/format-date";
import { SortableHeader } from "../_components/list-controls";
import { countryCodeToFlagEmoji, getCountryName } from "../_data/countries";
import { getConnectionStatus } from "./connection-status";
import type { SiteSummary } from "./sites.utils";

export function SitesTable({
  sites,
  basePath,
  currentParams,
}: {
  sites: SiteSummary[];
  basePath: string;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <SortableHeader basePath={basePath} currentParams={currentParams} field="name" label="Site" />
            <th>URL</th>
            <SortableHeader basePath={basePath} currentParams={currentParams} field="country" label="Country" />
            <th>Language</th>
            <th>Platform</th>
            <th>Status</th>
            <SortableHeader basePath={basePath} currentParams={currentParams} field="connection" label="Plugin connection" />
            <SortableHeader basePath={basePath} currentParams={currentParams} field="subscriberCount" label="Subscribers" />
            <SortableHeader basePath={basePath} currentParams={currentParams} field="createdAt" label="Added" />
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => {
            const connection = getConnectionStatus(site.lastConnectedAt);
            return (
              <tr key={site.id}>
                <td>
                  <Link href={`/sites/${site.id}`}>
                    <strong>{site.name}</strong>
                  </Link>
                </td>
                <td className="subtle" style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {site.url}
                </td>
                <td title={getCountryName(site.country)} style={{ fontSize: 20 }}>
                  {countryCodeToFlagEmoji(site.country) || site.country}
                </td>
                <td>{site.language}</td>
                <td>{site.platform}</td>
                <td>
                  <span className={`badge ${site.status}`}>{site.status}</span>
                </td>
                <td>
                  <span className={`badge ${connection.badgeClass}`}>{connection.label}</span>
                </td>
                <td>{site.subscribers.toLocaleString()}</td>
                <td className="subtle">{formatDisplayDate(site.createdAt)}</td>
                <td>
                  <Link className="subtle" href={`/sites/${site.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
          {sites.length === 0 ? (
            <tr>
              <td colSpan={10} className="subtle">
                No sites match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
