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
            vapidPublicKey: site.vapidPublicKey ?? "",
            appName: site.appName,
            iconUrl: site.iconUrl,
            themeColor: site.themeColor,
            optInPromptType: site.optInPromptType,
            optInPromptAnimation: site.optInPromptAnimation,
            optInPromptBackgroundColor: site.optInPromptBackgroundColor,
            optInPromptHeadline: site.optInPromptHeadline,
            optInPromptHeadlineTextColor: site.optInPromptHeadlineTextColor,
            optInPromptText: site.optInPromptText,
            optInPromptTextColor: site.optInPromptTextColor,
            optInPromptIconUrl: site.optInPromptIconUrl,
            optInPromptCancelButtonLabel: site.optInPromptCancelButtonLabel,
            optInPromptCancelButtonTextColor: site.optInPromptCancelButtonTextColor,
            optInPromptCancelButtonBackgroundColor: site.optInPromptCancelButtonBackgroundColor,
            optInPromptApproveButtonLabel: site.optInPromptApproveButtonLabel,
            optInPromptApproveButtonTextColor: site.optInPromptApproveButtonTextColor,
            optInPromptApproveButtonBackgroundColor: site.optInPromptApproveButtonBackgroundColor,
            optInPromptRepromptDelayDays: site.optInPromptRepromptDelayDays,
            optInPromptRecentNotificationsLimit: site.optInPromptRecentNotificationsLimit,
          }}
        />
      </section>
    </DashboardShell>
  );
}
