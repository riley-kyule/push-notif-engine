"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { countryCodeToFlagEmoji, getCountryName } from "../_data/countries";
import { getConnectionStatus } from "./connection-status";
import type { SiteSummary } from "./sites.utils";

export function SitesTable({ sites }: { sites: SiteSummary[] }) {
  const [search, setSearch] = useState("");

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return sites;
    }

    return sites.filter((site) =>
      [site.name, site.url, site.platform, getCountryName(site.country)].some((field) =>
        field.toLowerCase().includes(query),
      ),
    );
  }, [sites, search]);

  return (
    <section className="card">
      <div className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
        <label htmlFor="site-search">Search sites</label>
        <input
          id="site-search"
          className="input"
          type="search"
          placeholder="Search by name, URL, platform, or country"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Site</th>
              <th>URL</th>
              <th>Country</th>
              <th>Language</th>
              <th>Platform</th>
              <th>Status</th>
              <th>Plugin connection</th>
              <th>Subscribers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSites.map((site) => {
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
                  <td>
                    <Link className="subtle" href={`/sites/${site.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredSites.length === 0 ? (
              <tr>
                <td colSpan={9} className="subtle">
                  No sites match &quot;{search}&quot;.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
