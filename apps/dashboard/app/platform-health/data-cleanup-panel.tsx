"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "../../lib/api-client";
import { useToast } from "../_components/toast";
import type { SiteChoice } from "../_data/sites";

const INACTIVITY_PRESETS = [
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "365 days" },
] as const;

export function DataCleanupPanel({ sites }: { sites: SiteChoice[] }) {
  const router = useRouter();
  const toast = useToast();
  const [isClearingFailures, startClearFailures] = useTransition();
  const [isClearingAllHistory, startClearAllHistory] = useTransition();
  const [isClearingInactive, startClearInactive] = useTransition();
  const [applyToAllSites, setApplyToAllSites] = useState(true);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [inactiveSinceDays, setInactiveSinceDays] = useState(90);

  function handleClearFailedDeliveries() {
    if (!window.confirm("Clear all failed delivery history? This permanently deletes the records and can't be undone.")) {
      return;
    }

    startClearFailures(() => {
      void postJson<{ data: { cleared: number } }>("/api/dashboard/browser-push/clear-failed-deliveries")
        .then((result) => {
          toast.showSuccess(`Cleared ${result.data.cleared.toLocaleString()} failed delivery record${result.data.cleared === 1 ? "" : "s"}.`);
          router.refresh();
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : "Unable to clear failed deliveries.");
        });
    });
  }

  function handleClearAllDeliveryHistory() {
    if (
      !window.confirm(
        "Reset ALL delivery history -- sent, delivered, failed, everything? This resets every delivery metric (CTR, delivery rate, sent/delivered counts) to zero across every site and campaign. This cannot be undone.",
      )
    ) {
      return;
    }
    if (!window.confirm("Are you sure? This is a full reset, not just failed records.")) {
      return;
    }

    startClearAllHistory(() => {
      void postJson<{ data: { cleared: number } }>("/api/dashboard/browser-push/clear-all-delivery-history")
        .then((result) => {
          toast.showSuccess(`Reset ${result.data.cleared.toLocaleString()} delivery record${result.data.cleared === 1 ? "" : "s"}. Starting fresh.`);
          router.refresh();
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : "Unable to reset delivery history.");
        });
    });
  }

  function toggleSite(siteId: string) {
    setSelectedSiteIds((current) => (current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId]));
  }

  function handleClearInactiveSubscribers() {
    if (!applyToAllSites && selectedSiteIds.length === 0) {
      toast.showError("Select at least one site, or apply to all sites.");
      return;
    }

    const scopeLabel = applyToAllSites ? "all sites" : `${selectedSiteIds.length} selected site${selectedSiteIds.length === 1 ? "" : "s"}`;
    if (
      !window.confirm(
        `Mark every subscriber inactive for ${scopeLabel} who hasn't been seen in ${inactiveSinceDays} days? This can't be undone.`,
      )
    ) {
      return;
    }

    startClearInactive(() => {
      void postJson<{ data: { cleared: number } }>("/api/dashboard/subscribers/clear-inactive", {
        siteIds: applyToAllSites ? undefined : selectedSiteIds,
        inactiveSinceDays,
      })
        .then((result) => {
          toast.showSuccess(`Marked ${result.data.cleared.toLocaleString()} subscriber${result.data.cleared === 1 ? "" : "s"} inactive.`);
          router.refresh();
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : "Unable to clear inactive subscribers.");
        });
    });
  }

  return (
    <section className="card platform-health-data-cleanup">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Data cleanup</p>
          <h3>Reset stats and stale subscribers</h3>
        </div>
        <span className="badge warn">Super admin only</span>
      </div>

      <div className="grid cards-2" style={{ marginTop: 14 }}>
        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">Analytics</p>
          <p className="stat" style={{ marginBottom: 6 }}>
            Clear failed delivery stats
          </p>
          <p className="subtle">
            Permanently deletes every delivery record currently counted as "failed" -- a clean slate for the
            "Failed deliveries" card. Deliveries that are pending, sent, or delivered are untouched.
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="button secondary" type="button" onClick={handleClearFailedDeliveries} disabled={isClearingFailures}>
              {isClearingFailures ? "Clearing..." : "Clear failed only"}
            </button>
            <button className="button primary" type="button" onClick={handleClearAllDeliveryHistory} disabled={isClearingAllHistory}>
              {isClearingAllHistory ? "Resetting..." : "Reset ALL delivery history"}
            </button>
          </div>
          <p className="subtle" style={{ marginTop: 8 }}>
            "Reset ALL" zeroes out every metric (CTR, delivery rate, sent/delivered counts) across every site --
            use this for a true clean-slate start, not routine cleanup.
          </p>
        </article>

        <article className="card" style={{ margin: 0 }}>
          <p className="eyebrow">Subscribers</p>
          <p className="stat" style={{ marginBottom: 6 }}>
            Clear inactive subscribers
          </p>
          <p className="subtle">
            Marks subscribers as inactive if they haven't been seen in the selected period -- they stop being
            targeted by future sends. This does not delete them or touch their delivery history.
          </p>

          <label className="upload-field" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={applyToAllSites} onChange={(event) => setApplyToAllSites(event.target.checked)} />
            <span>Apply to all sites</span>
          </label>

          {!applyToAllSites ? (
            <div className="field" style={{ marginTop: 8 }}>
              <label className="subtle">Sites</label>
              <div className="grid cards-2" style={{ maxHeight: 160, overflowY: "auto", gap: 4 }}>
                {sites.map((site) => (
                  <label key={site.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={selectedSiteIds.includes(site.id)} onChange={() => toggleSite(site.id)} />
                    <span>{site.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="inactive-since-days" className="subtle">
              Inactive for at least
            </label>
            <select
              id="inactive-since-days"
              className="select"
              value={inactiveSinceDays}
              onChange={(event) => setInactiveSinceDays(Number(event.target.value))}
            >
              {INACTIVITY_PRESETS.map((preset) => (
                <option key={preset.days} value={preset.days}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="button primary"
            type="button"
            onClick={handleClearInactiveSubscribers}
            disabled={isClearingInactive}
            style={{ marginTop: 12 }}
          >
            {isClearingInactive ? "Clearing..." : "Clear inactive subscribers"}
          </button>
        </article>
      </div>
    </section>
  );
}
