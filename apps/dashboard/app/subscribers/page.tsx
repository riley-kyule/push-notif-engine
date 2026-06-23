import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getSubscriberList } from "../_data/subscribers";

export default async function SubscribersPage() {
  const subscribers = await getSubscriberList();

  return (
    <DashboardShell
      eyebrow="Subscribers"
      title="Subscriber collection"
      description="Search and monitor the web push audience across all Exotic sites."
    >
      <section className="card">
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
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
