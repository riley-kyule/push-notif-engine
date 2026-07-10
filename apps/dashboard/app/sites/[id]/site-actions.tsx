"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { SiteSummary } from "../sites.utils";
import {
  buildManifestAsset,
  buildSdkSnippet,
  buildServiceWorkerAsset,
  buildSubscriptionShortcode,
} from "../site-integrations";

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SiteActions({ site }: { site: SiteSummary }) {
  const router = useRouter();
  const [copiedSdkSnippet, setCopiedSdkSnippet] = useState(false);
  const [copiedShortcode, setCopiedShortcode] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("Delete this site? This removes the dashboard record only.");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/dashboard/sites/${site.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      window.alert("Unable to delete site.");
      return;
    }

    router.push("/sites");
    router.refresh();
  }

  async function handleCopySdkSnippet() {
    await navigator.clipboard.writeText(buildSdkSnippet(site));
    setCopiedSdkSnippet(true);
    window.setTimeout(() => setCopiedSdkSnippet(false), 1500);
  }

  async function handleCopySubscriptionShortcode() {
    await navigator.clipboard.writeText(buildSubscriptionShortcode());
    setCopiedShortcode(true);
    window.setTimeout(() => setCopiedShortcode(false), 1500);
  }

  return (
    <>
      <Link className="button secondary" href="/sites">
        Back to sites
      </Link>
      <Link className="button primary" href={`/sites/${site.id}/edit`}>
        Edit Site
      </Link>
      <button className="button secondary" type="button" onClick={handleCopySdkSnippet}>
        {copiedSdkSnippet ? "Copied SDK Snippet" : "Copy SDK Snippet"}
      </button>
      <button className="button secondary" type="button" onClick={handleCopySubscriptionShortcode}>
        {copiedShortcode ? "Copied Shortcode" : "Copy Subscription Shortcode"}
      </button>
      <button
        className="button secondary"
        type="button"
        onClick={() => downloadTextFile("push-sw.js", buildServiceWorkerAsset(site), "application/javascript")}
      >
        Download Service Worker
      </button>
      <button
        className="button secondary"
        type="button"
        onClick={() => downloadTextFile("manifest.json", buildManifestAsset(site), "application/manifest+json")}
      >
        Download manifest.json
      </button>
      <button className="button secondary" type="button" onClick={handleDelete}>
        Delete Site
      </button>
    </>
  );
}
