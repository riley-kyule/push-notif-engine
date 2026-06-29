import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "../../_components/dashboard-shell";
import { formatDisplayDateTime } from "../../_components/format-date";
import { getSubscriber } from "../../_data/subscribers";
import { formatCountryName } from "../../../lib/country-names";

export default async function SubscriberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subscriber = await getSubscriber(id);

  if (!subscriber) {
    notFound();
  }

  return (
    <DashboardShell
      eyebrow="Subscribers"
      title={subscriber.endpoint}
      description="Inspect the subscriber's delivery history and current status."
      actions={
        <Link className="button secondary" href="/subscribers">
          Back to subscribers
        </Link>
      }
    >
      <section className="grid cards-4">
        <article className="card">
          <h3>Browser</h3>
          <p className="stat">{subscriber.browser}</p>
        </article>
        <article className="card">
          <h3>Device</h3>
          <p className="stat">{subscriber.deviceType}</p>
        </article>
        <article className="card">
          <h3>Country</h3>
          <p className="stat">{formatCountryName(subscriber.country)}</p>
        </article>
        <article className="card">
          <h3>Status</h3>
          <p className={`badge ${subscriber.status}`}>{subscriber.status}</p>
        </article>
        <article className="card">
          <h3>Last seen (UTC+3)</h3>
          <p className="stat">{subscriber.lastSeenAt ? formatDisplayDateTime(subscriber.lastSeenAt) : "Never"}</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Delivery history</h3>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {subscriber.history.map((event) => (
            <article key={event.id} className="card" style={{ boxShadow: "none", background: "var(--surface-raised)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{event.campaign}</strong>
                <span className={`badge ${event.status}`}>{event.status}</span>
              </div>
              <p className="subtle" style={{ marginBottom: 0 }}>
                {formatDisplayDateTime(event.timestamp)} · {event.channel.toUpperCase()} · {event.status}
              </p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
