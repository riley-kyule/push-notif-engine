import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { buildHref } from "../_components/list-controls.utils";
import { PageSizeSelect, Pagination } from "../_components/list-controls";
import { getSubscriberList, getSubscriberStatusCounts, type SubscriberSortField } from "../_data/subscribers";
import { fallbackSiteChoices, getSiteChoices } from "../_data/sites";
import { SubscribersTable } from "./subscribers-table";

const statusTabs = [
  { value: undefined, label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "expired", label: "Expired" },
] as const;

const DEVICE_TYPES = ["desktop", "mobile", "tablet"] as const;
const SORT_FIELDS = ["createdAt", "lastSeenAt", "country", "browser", "deviceType", "status"] as const;

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    siteId?: string;
    deviceType?: string;
    page?: string;
    pageSize?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}) {
  const query = await searchParams;
  const status = statusTabs.some((tab) => tab.value === query.status)
    ? (query.status as "active" | "inactive" | "unsubscribed" | "expired" | undefined)
    : undefined;
  const deviceType = (DEVICE_TYPES as readonly string[]).includes(query.deviceType ?? "") ? query.deviceType : undefined;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Number.parseInt(query.pageSize ?? "25", 10) || 25;
  const sortBy = (SORT_FIELDS as readonly string[]).includes(query.sortBy ?? "")
    ? (query.sortBy as SubscriberSortField)
    : undefined;
  const sortDir = query.sortDir === "asc" ? "asc" : query.sortDir === "desc" ? "desc" : undefined;

  const [subscribers, counts, sites] = await Promise.all([
    getSubscriberList({
      status,
      siteId: query.siteId,
      deviceType,
      sortBy,
      sortDir,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getSubscriberStatusCounts(query.siteId),
    getSiteChoices().catch(() => fallbackSiteChoices),
  ]);

  const realSites = sites.filter((site) => site.id !== "site-3");
  const siteNames = Object.fromEntries(sites.map((site) => [site.id, site.name]));
  const currentParams = {
    status: query.status,
    siteId: query.siteId,
    deviceType: query.deviceType,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    pageSize: String(pageSize),
  };

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
        <div className="actions" style={{ marginBottom: 14, flexWrap: "wrap" }}>
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

        <div className="grid cards-2" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Site</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              <Link
                href={buildHref("/subscribers", { ...currentParams, siteId: undefined, page: "1" })}
                className={`button secondary ${!query.siteId ? "is-disabled" : ""}`}
              >
                All sites
              </Link>
              {realSites.map((site) => (
                <Link
                  key={site.id}
                  href={buildHref("/subscribers", { ...currentParams, siteId: site.id, page: "1" })}
                  className={`button secondary ${query.siteId === site.id ? "is-disabled" : ""}`}
                >
                  {site.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Device</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              <Link
                href={buildHref("/subscribers", { ...currentParams, deviceType: undefined, page: "1" })}
                className={`button secondary ${!query.deviceType ? "is-disabled" : ""}`}
              >
                All devices
              </Link>
              {DEVICE_TYPES.map((device) => (
                <Link
                  key={device}
                  href={buildHref("/subscribers", { ...currentParams, deviceType: device, page: "1" })}
                  className={`button secondary ${query.deviceType === device ? "is-disabled" : ""}`}
                >
                  {device}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="actions" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
          <PageSizeSelect basePath="/subscribers" currentParams={currentParams} pageSize={pageSize} />
        </div>

        <SubscribersTable subscribers={subscribers.items} siteNames={siteNames} basePath="/subscribers" currentParams={currentParams} />

        <Pagination basePath="/subscribers" currentParams={currentParams} page={page} pageSize={pageSize} total={subscribers.total} />
      </section>
    </DashboardShell>
  );
}
