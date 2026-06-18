import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { SiteEditor } from "../site-editor";

export default function NewSitePage() {
  return (
    <DashboardShell
      eyebrow="Sites"
      title="Add a site"
      description="Prepare a new Exotic website for push integration, credentials, and dashboard tracking."
      actions={
        <Link className="button secondary" href="/sites">
          Back to sites
        </Link>
      }
    >
      <section className="card">
        <SiteEditor
          mode="create"
          initialValues={{
            name: "",
            url: "",
            country: "",
            language: "en",
            platform: "WordPress",
            status: "active",
            subscribers: 0,
            vapidPublicKey: "",
          }}
        />
      </section>
    </DashboardShell>
  );
}
