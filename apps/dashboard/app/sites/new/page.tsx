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
            vapidPublicKey: "",
            appName: "",
            iconUrl: "",
            themeColor: "#1c1917",
            optInPromptType: "lightbox-1",
            optInPromptAnimation: "slide-in",
            optInPromptBackgroundColor: "#ffffff",
            optInPromptHeadline: "Stay in the loop",
            optInPromptHeadlineTextColor: "#111111",
            optInPromptText: "Get important updates delivered to your browser.",
            optInPromptTextColor: "#444444",
            optInPromptIconUrl: "",
            optInPromptCancelButtonLabel: "Not now",
            optInPromptCancelButtonTextColor: "#ffffff",
            optInPromptCancelButtonBackgroundColor: "#111111",
            optInPromptApproveButtonLabel: "Enable",
            optInPromptApproveButtonTextColor: "#ffffff",
            optInPromptApproveButtonBackgroundColor: "#ea580c",
            optInPromptRepromptDelayDays: 30,
            optInPromptRecentNotificationsLimit: 3,
          }}
        />
      </section>
    </DashboardShell>
  );
}
