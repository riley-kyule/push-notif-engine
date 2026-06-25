import Link from "next/link";

import { formatDisplayDateTime } from "../_components/format-date";
import { SortableHeader } from "../_components/list-controls";
import type { SubscriberSummary } from "../_data/subscribers";

export function SubscribersTable({
  subscribers,
  siteNames,
  basePath,
  currentParams,
}: {
  subscribers: SubscriberSummary[];
  siteNames: Record<string, string>;
  basePath: string;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Site</th>
            <SortableHeader basePath={basePath} currentParams={currentParams} field="browser" label="Browser" />
            <SortableHeader basePath={basePath} currentParams={currentParams} field="deviceType" label="Device" />
            <SortableHeader basePath={basePath} currentParams={currentParams} field="country" label="Country" />
            <th>Language</th>
            <SortableHeader basePath={basePath} currentParams={currentParams} field="lastSeenAt" label="Last Seen (UTC+3)" />
            <SortableHeader basePath={basePath} currentParams={currentParams} field="status" label="Status" />
          </tr>
        </thead>
        <tbody>
          {subscribers.map((subscriber) => (
            <tr key={subscriber.id}>
              <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <Link href={`/subscribers/${subscriber.id}`}>
                  <strong>{subscriber.endpoint}</strong>
                </Link>
              </td>
              <td className="subtle">{siteNames[subscriber.siteId] ?? subscriber.siteId}</td>
              <td>{subscriber.browser}</td>
              <td>{subscriber.deviceType}</td>
              <td>{subscriber.country}</td>
              <td>{subscriber.language}</td>
              <td className="subtle">{subscriber.lastSeenAt ? formatDisplayDateTime(subscriber.lastSeenAt) : "Never"}</td>
              <td>
                <span className={`badge ${subscriber.status}`}>{subscriber.status}</span>
              </td>
            </tr>
          ))}
          {subscribers.length === 0 ? (
            <tr>
              <td colSpan={8} className="subtle">
                No subscribers match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
