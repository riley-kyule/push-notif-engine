import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { buildHref } from "../_components/list-controls.utils";
import { PageSizeSelect, Pagination } from "../_components/list-controls";
import { getMediaLibrary } from "../_data/media-library";
import { fallbackSiteChoices, getSiteChoices } from "../_data/sites";

const KINDS = ["image", "icon"] as const;

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; kind?: string; page?: string; pageSize?: string }>;
}) {
  const query = await searchParams;
  const kind = (KINDS as readonly string[]).includes(query.kind ?? "") ? (query.kind as "image" | "icon") : undefined;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Number.parseInt(query.pageSize ?? "50", 10) || 50;

  const [media, sites] = await Promise.all([
    getMediaLibrary({ siteId: query.siteId, kind, limit: pageSize, offset: (page - 1) * pageSize }),
    getSiteChoices().catch(() => fallbackSiteChoices),
  ]);

  const realSites = sites.filter((site) => site.id !== "site-3");
  const siteNames = Object.fromEntries(sites.map((site) => [site.id, site.name]));
  const currentParams = { siteId: query.siteId, kind: query.kind, pageSize: String(pageSize) };

  return (
    <DashboardShell
      eyebrow="System"
      title="Media library"
      description="Every image and icon uploaded across all sites, in one place -- reused from the gallery picker in site and campaign forms."
    >
      <section className="card">
        <div className="grid cards-2" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Site</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              <Link
                href={buildHref("/media-library", { ...currentParams, siteId: undefined, page: "1" })}
                className={`button secondary ${!query.siteId ? "is-disabled" : ""}`}
              >
                All sites
              </Link>
              {realSites.map((site) => (
                <Link
                  key={site.id}
                  href={buildHref("/media-library", { ...currentParams, siteId: site.id, page: "1" })}
                  className={`button secondary ${query.siteId === site.id ? "is-disabled" : ""}`}
                >
                  {site.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="subtle">Type</span>
            <div className="actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
              <Link
                href={buildHref("/media-library", { ...currentParams, kind: undefined, page: "1" })}
                className={`button secondary ${!query.kind ? "is-disabled" : ""}`}
              >
                All types
              </Link>
              {KINDS.map((value) => (
                <Link
                  key={value}
                  href={buildHref("/media-library", { ...currentParams, kind: value, page: "1" })}
                  className={`button secondary ${query.kind === value ? "is-disabled" : ""}`}
                >
                  {value === "image" ? "Images" : "Icons"}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="actions" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
          <PageSizeSelect basePath="/media-library" currentParams={currentParams} pageSize={pageSize} />
        </div>

        {media.items.length === 0 ? (
          <p className="subtle">No uploads match your filters yet.</p>
        ) : (
          <div className="media-gallery-grid">
            {media.items.map((asset) => (
              <a
                key={asset.id}
                href={asset.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="media-gallery-item"
                title={`${asset.originalName} — ${siteNames[asset.siteId] ?? asset.siteId}`}
              >
                <img src={asset.publicUrl} alt={asset.originalName} />
              </a>
            ))}
          </div>
        )}

        {media.items.length > 0 ? (
          <p className="subtle" style={{ marginTop: 10 }}>
            Hover an item for its file name and site; click to open the full image.
          </p>
        ) : null}

        <Pagination basePath="/media-library" currentParams={currentParams} page={page} pageSize={pageSize} total={media.total} />
      </section>
    </DashboardShell>
  );
}
