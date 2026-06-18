import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "../../../_components/dashboard-shell";
import { getSiteById } from "../../sites.utils";
import { SiteEditor } from "../../site-editor";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getSiteById(id);

  if (!site) {
    notFound();
  }

  return (
    <DashboardShell
      eyebrow="Sites"
      title={`Edit ${site.name}`}
      description="Update the site metadata, platform type, and integration readiness."
      actions={
        <Link className="button secondary" href={`/sites/${site.id}`}>
          Back to site
        </Link>
      }
    >
      <section className="card">
        <SiteEditor
          mode="edit"
          siteId={site.id}
          initialValues={{
            name: site.name,
            url: site.url,
            country: site.country,
            language: site.language,
            platform: site.platform,
            status: site.status,
            subscribers: site.subscribers,
            vapidPublicKey: site.vapidPublicKey ?? "",
          }}
        />
      </section>
    </DashboardShell>
  );
}
