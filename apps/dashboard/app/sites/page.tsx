import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { getSiteList } from "./sites.utils";

export default async function SitesPage() {
  const sites = await getSiteList();

  return (
    <DashboardShell
      eyebrow="Sites"
      title="Site management"
      description="Manage Exotic websites, push credentials, and per-site integration status."
      actions={
        <Link className="button primary" href="/sites/new">
          Add Site
        </Link>
      }
      >
      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Site</th>
              <th>URL</th>
              <th>Country</th>
              <th>Language</th>
              <th>Platform</th>
              <th>Status</th>
              <th>Subscribers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.items.map((site) => (
              <tr key={site.id}>
                <td>
                  <Link href={`/sites/${site.id}`}>
                    <strong>{site.name}</strong>
                  </Link>
                </td>
                <td className="subtle">{site.url}</td>
                <td>{site.country}</td>
                <td>{site.language}</td>
                <td>{site.platform}</td>
                <td>
                  <span className={`badge ${site.status}`}>{site.status}</span>
                </td>
                <td>{site.subscribers.toLocaleString()}</td>
                <td>
                  <Link className="subtle" href={`/sites/${site.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DashboardShell>
  );
}
