"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { postJson } from "../../lib/api-client";
import { useToast } from "../_components/toast";

export function ReengagementTemplate({ sites }: { sites: Array<{ id: string; name: string }> }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [days, setDays] = useState(30);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function create() {
    if (!siteId) return;
    startTransition(() => {
      void postJson("/api/dashboard/segments", {
        siteId,
        name: `Re-engagement – inactive ${days}+ days`,
        description: `Active subscribers not seen for more than ${days} days.`,
        status: "active",
        definition: {
          matchMode: "all",
          rules: [
            { field: "status", operator: "is", value: "active" },
            { field: "lastSeenAt", operator: "olderThanDays", value: days },
          ],
        },
      })
        .then(() => {
          toast.showSuccess("Re-engagement segment created.");
          router.refresh();
        })
        .catch((error) => toast.showError(error instanceof Error ? error.message : "Unable to create segment."));
    });
  }

  return (
    <div className="grid cards-3">
      <label className="field">
        <span className="subtle">Site</span>
        <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="subtle">Inactive for</span>
        <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
          <option value={30}>30+ days</option>
          <option value={60}>60+ days</option>
          <option value={90}>90+ days</option>
        </select>
      </label>
      <div className="field" style={{ justifyContent: "end" }}>
        <button className="button primary" type="button" disabled={pending || !siteId} onClick={create}>
          {pending ? "Creating…" : "Create re-engagement segment"}
        </button>
      </div>
    </div>
  );
}
