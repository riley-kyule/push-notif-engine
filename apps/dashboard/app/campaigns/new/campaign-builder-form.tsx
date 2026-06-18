"use client";

import { useMemo, useState } from "react";

import { buildUrl, parseDateTime } from "./campaign-builder.utils";
import type { SegmentChoice } from "../../_data/segments";
import type { SiteChoice } from "../../_data/sites";

type CampaignType = "instant" | "scheduled" | "recurring";
type CampaignChannel = "web" | "mobile" | "all";

interface CampaignBuilderFormProps {
  sites: SiteChoice[];
  segments: SegmentChoice[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function CampaignBuilderForm({ sites, segments }: CampaignBuilderFormProps) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "site-1");
  const [segmentId, setSegmentId] = useState<string>("");
  const [name, setName] = useState("Launch Week");
  const [title, setTitle] = useState("Big Safari Sale");
  const [message, setMessage] = useState("Save 30% on last-minute wilderness stays.");
  const [destination, setDestination] = useState("https://example.com/safari-sale");
  const [channel, setChannel] = useState<CampaignChannel>("web");
  const [type, setType] = useState<CampaignType>("scheduled");
  const [schedule, setSchedule] = useState("2026-06-18T09:00");
  const [imageUrl, setImageUrl] = useState("https://example.com/hero.png");
  const [iconUrl, setIconUrl] = useState("https://example.com/icon.png");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const previewButtons = useMemo(
    () => [
      { label: "View Deal", url: destination },
      { label: "Dismiss", url: destination },
    ],
    [destination],
  );

  const segmentsForSite = useMemo(() => segments.filter((segment) => segment.siteId === siteId), [segments, siteId]);

  function handleSiteChange(nextSiteId: string) {
    setSiteId(nextSiteId);
    if (!segments.some((segment) => segment.siteId === nextSiteId && segment.id === segmentId)) {
      setSegmentId("");
    }
  }

  const campaignPayload = {
    siteId,
    segmentId: segmentId || null,
    name,
    channel,
    type,
    title,
    message,
    url: destination,
    imageUrl,
    iconUrl,
    buttons: [{ label: "View Deal", url: destination }],
    expirationAt: null,
    status: "draft" as const,
    scheduledAt: type === "instant" ? null : parseDateTime(schedule),
    timezone: "Africa/Nairobi",
    recurrenceType: type === "recurring" ? "weekly" : null,
    recurrenceInterval: type === "recurring" ? 1 : null,
    recurrenceUntilAt: type === "recurring" ? parseDateTime(schedule) : null,
  };

  async function saveDraft() {
    setIsSavingDraft(true);
    setStatusMessage(null);

    try {
      const response = await postJson<{ success: true; data: { id: string } }>(
        buildUrl("/api/dashboard", "/campaigns"),
        {
          ...campaignPayload,
          status: "draft",
          scheduledAt: null,
          recurrenceType: null,
          recurrenceInterval: null,
          recurrenceUntilAt: null,
        },
      );
      setStatusMessage(`Draft saved (${response.data.id})`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function scheduleCampaign() {
    setIsScheduling(true);
    setStatusMessage(null);

    try {
      const created = await postJson<{ success: true; data: { id: string } }>(buildUrl("/api/dashboard", "/campaigns"), {
        ...campaignPayload,
        status: "scheduled",
      });

      const scheduledAt = parseDateTime(schedule);
      if (scheduledAt) {
        await postJson(buildUrl("/api/dashboard", `/campaigns/${created.data.id}/schedule`), {
          scheduledAt,
          timezone: "Africa/Nairobi",
          recurrenceType: type === "recurring" ? "weekly" : null,
          recurrenceInterval: type === "recurring" ? 1 : null,
          recurrenceUntilAt: type === "recurring" ? scheduledAt : null,
        });
      }

      setStatusMessage(`Campaign scheduled (${created.data.id})`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to schedule campaign");
    } finally {
      setIsScheduling(false);
    }
  }

  return (
    <div className="builder">
      <section className="card">
        <div className="tabs" aria-label="Builder steps">
          {["Content", "Audience", "Schedule", "Review"].map((step, index) => (
            <span key={step} className={`tab ${index === 0 ? "active" : ""}`}>
              {index + 1}. {step}
            </span>
          ))}
        </div>

        <div className="field">
          <label htmlFor="siteId">Site</label>
          <select className="select" id="siteId" value={siteId} onChange={(event) => handleSiteChange(event.target.value)}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} - {site.country}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="segmentId">Audience</label>
          <select className="select" id="segmentId" value={segmentId} onChange={(event) => setSegmentId(event.target.value)}>
            <option value="">All active subscribers</option>
            {segmentsForSite.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="name">Campaign name</label>
          <input className="input" id="name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="channel">Channel</label>
          <select className="select" id="channel" value={channel} onChange={(event) => setChannel(event.target.value as CampaignChannel)}>
            <option value="web">Web Push</option>
            <option value="mobile">Mobile Push</option>
            <option value="all">All Channels</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="type">Campaign type</label>
          <select className="select" id="type" value={type} onChange={(event) => setType(event.target.value as CampaignType)}>
            <option value="instant">Instant</option>
            <option value="scheduled">Scheduled</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input className="input" id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea className="textarea" id="message" value={message} onChange={(event) => setMessage(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="destination">Destination URL</label>
          <input className="input" id="destination" value={destination} onChange={(event) => setDestination(event.target.value)} />
        </div>

        <div className="grid cards-3">
          <div className="field">
            <label htmlFor="image">Image URL</label>
            <input className="input" id="image" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="icon">Icon URL</label>
            <input className="input" id="icon" value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="schedule">Send time</label>
            <input className="input" id="schedule" type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Action buttons</label>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {previewButtons.map((button) => (
              <div key={button.label} className="card" style={{ boxShadow: "none", background: "var(--surface-raised)" }}>
                <strong>{button.label}</strong>
                <div className="subtle">{button.url}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="actions" style={{ justifyContent: "space-between", marginTop: 24 }}>
          <span className="subtle">{statusMessage ?? "Save as draft or schedule when ready."}</span>
          <div className="actions">
            <button className="button secondary" type="button" disabled={isSavingDraft || isScheduling}>
              Back
            </button>
            <button className="button secondary" type="button" onClick={saveDraft} disabled={isSavingDraft || isScheduling}>
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </button>
            <button className="button primary" type="button" onClick={scheduleCampaign} disabled={isSavingDraft || isScheduling}>
              {isScheduling ? "Scheduling..." : "Schedule Campaign"}
            </button>
          </div>
        </div>
      </section>

      <aside className="preview">
        <div className="card preview-card">
          <div className="preview-head">
            <span>Platform: Chrome</span>
            <span>{channel}</span>
          </div>
          <div className="preview-image" />
          <p className="preview-title">{title}</p>
          <p className="preview-body">{message}</p>
          <div className="actions">
            <button className="button primary" type="button">
              View Deal
            </button>
            <button className="button secondary" type="button">
              Dismiss
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Scheduling summary</h3>
          <p className="subtle">Type: {type}</p>
          <p className="subtle">Send time: {schedule}</p>
          <p className="subtle">Destination: {destination}</p>
          <p className="subtle">
            Audience: {segmentsForSite.find((segment) => segment.id === segmentId)?.name ?? "All active subscribers"}
          </p>
        </div>
      </aside>
    </div>
  );
}
