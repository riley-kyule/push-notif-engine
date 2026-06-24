// Pure, no server-only imports -- safe to import from client components
// (sites-table.tsx) as well as server components ([id]/page.tsx), unlike
// sites.utils.ts which pulls in next/headers via apiJson.

// The WordPress plugin caches its config fetch for 15 minutes (see
// get_site_config() in epe-push.php), so a generous window avoids flagging an
// actively-connected site as disconnected between its own polling intervals.
const CONNECTION_FRESH_WINDOW_MS = 30 * 60 * 1000;

export function getConnectionStatus(lastConnectedAt: string | null): { label: string; badgeClass: string } {
  if (!lastConnectedAt) {
    return { label: "Disconnected", badgeClass: "neutral" };
  }

  const elapsedMs = Date.now() - new Date(lastConnectedAt).getTime();
  if (elapsedMs <= CONNECTION_FRESH_WINDOW_MS) {
    return { label: "Connected", badgeClass: "good" };
  }

  return { label: "Disconnected", badgeClass: "warn" };
}
