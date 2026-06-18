"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import type { SiteSummary } from "./sites.utils";

interface BrowserPushDispatchPanelProps {
  site: SiteSummary;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export function BrowserPushDispatchPanel({ site }: BrowserPushDispatchPanelProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim();
    const image = String(formData.get("image") ?? "").trim();

    setStatus(null);

    if (!title || !body || !url) {
      setStatus("Title, body, and URL are required.");
      return;
    }

    startTransition(() => {
      void postJson<{ success: true; data: { jobId?: string; queued: true } }>("/api/dashboard/browser-push/dispatch", {
        siteId: site.id,
        title,
        body,
        url,
        icon: icon || null,
        image: image || null,
        campaignId: null,
      })
        .then((result) => {
          setStatus(result.data.jobId ? `Queued as job ${result.data.jobId}` : "Queued successfully");
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : "Unable to queue browser push");
        });
    });
  }

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <strong>Dispatch Browser Push</strong>
        <span className="subtle">{status ?? "Send a queued notification to this site"}</span>
      </div>

      <form className="login-form" style={{ marginTop: 16 }} onSubmit={handleDispatch}>
        <div className="field-grid">
          <div className="field-group">
            <label htmlFor={`push-title-${site.id}`}>Title</label>
            <input id={`push-title-${site.id}`} name="title" defaultValue={`${site.name} update`} placeholder="Campaign title" />
          </div>

          <div className="field-group">
            <label htmlFor={`push-url-${site.id}`}>URL</label>
            <input id={`push-url-${site.id}`} name="url" defaultValue={site.url} placeholder="https://example.com/article" />
          </div>
        </div>

        <div className="field-group">
          <label htmlFor={`push-body-${site.id}`}>Message</label>
          <input
            id={`push-body-${site.id}`}
            name="body"
            defaultValue={`New update from ${site.name}.`}
            placeholder="Message body"
          />
        </div>

        <div className="field-grid">
          <div className="field-group">
            <label htmlFor={`push-icon-${site.id}`}>Icon URL</label>
            <input id={`push-icon-${site.id}`} name="icon" placeholder="https://example.com/icon.png" />
          </div>

          <div className="field-group">
            <label htmlFor={`push-image-${site.id}`}>Image URL</label>
            <input id={`push-image-${site.id}`} name="image" placeholder="https://example.com/image.png" />
          </div>
        </div>

        <button className="button primary login-submit" type="submit" disabled={isPending}>
          {isPending ? "Queueing..." : "Queue Push"}
        </button>
      </form>
    </section>
  );
}
