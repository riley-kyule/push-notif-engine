"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { SiteSummary } from "../sites.utils";
import { buildManifestAsset, buildSdkSnippet, buildServiceWorkerAsset } from "../site-integrations";

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
  const [copied, setCopied] = useState(false);

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
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
        {copied ? "Copied SDK Snippet" : "Copy SDK Snippet"}
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
