import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getSubscriberList, getSubscriberStatusCounts } from "../_data/subscribers";

const statusTabs = [
  { value: undefined, label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "expired", label: "Expired" },
] as const;

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const query = await searchParams;
  const status = statusTabs.some((tab) => tab.value === query.status)
    ? (query.status as "active" | "inactive" | "unsubscribed" | "expired" | undefined)
    : undefined;

  const [subscribers, counts] = await Promise.all([getSubscriberList({ status }), getSubscriberStatusCounts()]);

  return (
    <DashboardShell
      eyebrow="Subscribers"
      title="Subscriber collection"
      description="Search and monitor the web push audience across all Exotic sites."
    >
      <section className="grid cards-3">
        <article className="card">
          <p className="eyebrow">Total</p>
          <p className="stat">{counts.total.toLocaleString()}</p>
          <p className="subtle">Across all sites</p>
        </article>
        <article className="card">
          <p className="eyebrow">Active</p>
          <p className="stat">{counts.active.toLocaleString()}</p>
          <p className="subtle">Currently subscribed</p>
        </article>
        <article className="card">
          <p className="eyebrow">Unsubscribed</p>
          <p className="stat">{counts.unsubscribed.toLocaleString()}</p>
          <p className="subtle">Opted out of notifications</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="actions" style={{ marginBottom: 14 }}>
          {statusTabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.value ? `/subscribers?status=${tab.value}` : "/subscribers"}
              className={`button ${status === tab.value ? "primary" : "secondary"}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Browser</th>
                <th>Device</th>
                <th>Country</th>
                <th>Language</th>
                <th>Last Seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.items.map((subscriber) => (
                <tr key={subscriber.id}>
                  <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Link href={`/subscribers/${subscriber.id}`}>
                      <strong>{subscriber.endpoint}</strong>
                    </Link>
                  </td>
                  <td>{subscriber.browser}</td>
                  <td>{subscriber.deviceType}</td>
                  <td>{subscriber.country}</td>
                  <td>{subscriber.language}</td>
                  <td className="subtle">{subscriber.lastSeenAt}</td>
                  <td>
                    <span className={`badge ${subscriber.status}`}>{subscriber.status}</span>
                  </td>
                </tr>
              ))}
              {subscribers.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="subtle">
                    No subscribers match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
