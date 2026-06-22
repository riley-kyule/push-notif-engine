import { DashboardShell } from "../../_components/dashboard-shell";
import { BackupConfigPanel } from "./backup-config-panel";

export default async function BackupConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <DashboardShell
      eyebrow="Platform"
      title="Backup Config"
      description="Connect Dropbox or Google Drive and EPE handles the rest — full system backups on a schedule, or on demand."
    >
      <BackupConfigPanel connectedNotice={params.connected} errorNotice={params.error} />
    </DashboardShell>
  );
}
