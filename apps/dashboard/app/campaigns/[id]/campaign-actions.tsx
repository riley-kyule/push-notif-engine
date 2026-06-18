"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CampaignActionsProps {
  campaignId: string;
  initialName: string;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function CampaignActions({ campaignId, initialName }: CampaignActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    message: string;
    url: string;
    buttons: Array<{ label: string; url: string }>;
  } | null>(null);
  const [busy, setBusy] = useState<"clone" | "preview" | "schedule" | "send" | null>(null);

  async function handleSendNow() {
    setBusy("send");
    setStatus(null);
    try {
      await postJson(`/api/dashboard/campaigns/${campaignId}/send`);
      setStatus("Campaign queued for dispatch");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send campaign");
    } finally {
      setBusy(null);
    }
  }

  async function handleClone() {
    setBusy("clone");
    setStatus(null);
    try {
      const result = await postJson<{ success: true; data: { id: string } }>(`/api/dashboard/campaigns/${campaignId}/clone`, {
        name: `${initialName} Copy`,
      });
      setCloneId(result.data.id);
      setStatus(`Cloned as ${result.data.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to clone campaign");
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview() {
    setBusy("preview");
    setStatus(null);
    try {
      const result = await postJson<{
        success: true;
        data: { title: string; message: string; url: string; preview: Array<{ label: string; url: string }> };
      }>(`/api/dashboard/campaigns/${campaignId}/preview`);
      setPreview({
        title: result.data.title,
        message: result.data.message,
        url: result.data.url,
        buttons: result.data.preview,
      });
      setStatus("Preview refreshed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to preview campaign");
    } finally {
      setBusy(null);
    }
  }

  async function handleScheduleNow() {
    setBusy("schedule");
    setStatus(null);
    try {
      await postJson(`/api/dashboard/campaigns/${campaignId}/schedule`, {
        scheduledAt: new Date().toISOString(),
        timezone: "Africa/Nairobi",
        recurrenceType: null,
        recurrenceInterval: null,
        recurrenceUntilAt: null,
      });
      setStatus("Campaign scheduled for immediate dispatch");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to schedule campaign");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <strong>Campaign actions</strong>
        <span className="subtle">{status ?? "Ready for action"}</span>
      </div>

      <div className="actions" style={{ marginTop: 12 }}>
        <button className="button secondary" type="button" onClick={handlePreview} disabled={busy !== null}>
          {busy === "preview" ? "Previewing..." : "Preview Campaign"}
        </button>
        <button className="button secondary" type="button" onClick={handleClone} disabled={busy !== null}>
          {busy === "clone" ? "Cloning..." : "Clone Campaign"}
        </button>
        <button className="button secondary" type="button" onClick={handleScheduleNow} disabled={busy !== null}>
          {busy === "schedule" ? "Scheduling..." : "Schedule Now"}
        </button>
        <button className="button primary" type="button" onClick={handleSendNow} disabled={busy !== null}>
          {busy === "send" ? "Sending..." : "Send Now"}
        </button>
      </div>

      {cloneId ? (
        <p className="subtle" style={{ marginTop: 12 }}>
          Clone created: <Link href={`/campaigns/${cloneId}`}>{cloneId}</Link>
        </p>
      ) : null}

      {preview ? (
        <div className="preview-card" style={{ marginTop: 18 }}>
          <div className="preview-head">
            <span>Live preview</span>
            <span>{preview.url}</span>
          </div>
          <p className="preview-title">{preview.title}</p>
          <p className="preview-body">{preview.message}</p>
          <div className="actions">
            {preview.buttons.map((button) => (
              <button key={button.label} className="button secondary" type="button">
                {button.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
