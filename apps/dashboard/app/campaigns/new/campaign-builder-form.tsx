"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buildUrl, parseDateTime } from "./campaign-builder.utils";
import { uploadMedia } from "../../../lib/upload-media";
import type { CampaignTaxonomyChoice } from "../../_data/campaign-taxonomies";
import type { SegmentChoice } from "../../_data/segments";
import type { SiteChoice } from "../../_data/sites";

type CampaignType = "instant" | "scheduled" | "recurring";
type CampaignChannel = "web" | "mobile" | "all";

interface CampaignBuilderFormProps {
  sites: SiteChoice[];
  segments: SegmentChoice[];
  taxonomies: CampaignTaxonomyChoice[];
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

export function CampaignBuilderForm({ sites, segments, taxonomies }: CampaignBuilderFormProps) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "site-1");
  const [segmentId, setSegmentId] = useState<string>("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [destination, setDestination] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("web");
  const [type, setType] = useState<CampaignType>("scheduled");
  const [contentType, setContentType] = useState(taxonomies.find((taxonomy) => taxonomy.slug === "promotion")?.slug ?? taxonomies[0]?.slug ?? "promotion");
  const [schedule, setSchedule] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [iconAssetId, setIconAssetId] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [iconFileName, setIconFileName] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [showButtons, setShowButtons] = useState(true);
  const [primaryButtonLabel, setPrimaryButtonLabel] = useState("View Deal");
  const [primaryButtonUrl, setPrimaryButtonUrl] = useState(destination);
  const [secondaryButtonLabel, setSecondaryButtonLabel] = useState("Dismiss");
  const [secondaryButtonUrl, setSecondaryButtonUrl] = useState(destination);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const previewButtons = useMemo(
    () =>
      showButtons
        ? [
            { label: primaryButtonLabel, url: primaryButtonUrl },
            { label: secondaryButtonLabel, url: secondaryButtonUrl },
          ]
        : [],
    [primaryButtonLabel, primaryButtonUrl, secondaryButtonLabel, secondaryButtonUrl, showButtons],
  );

  const segmentsForSite = useMemo(() => segments.filter((segment) => segment.siteId === siteId), [segments, siteId]);

  function handleSiteChange(nextSiteId: string) {
    setSiteId(nextSiteId);
    if (!segments.some((segment) => segment.siteId === nextSiteId && segment.id === segmentId)) {
      setSegmentId("");
    }
    setImageAssetId(null);
    setIconAssetId(null);
    setImageUrl("");
    setIconUrl("");
    setImageFileName(null);
    setIconFileName(null);
  }

  async function handleImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploadingImage(true);
    setStatusMessage(null);
    try {
      const asset = await uploadMedia(siteId, "image", file);
      setImageAssetId(asset.id);
      setImageUrl(asset.publicUrl);
      setImageFileName(file.name);
      setStatusMessage("Campaign image uploaded");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleIconUpload(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploadingIcon(true);
    setStatusMessage(null);
    try {
      const asset = await uploadMedia(siteId, "icon", file);
      setIconAssetId(asset.id);
      setIconUrl(asset.publicUrl);
      setIconFileName(file.name);
      setStatusMessage("Campaign icon uploaded");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to upload icon");
    } finally {
      setIsUploadingIcon(false);
    }
  }

  const campaignPayload = {
    siteId,
    segmentId: segmentId || null,
    name,
    channel,
    type,
    contentType,
    title,
    message,
    url: destination,
    imageUrl,
    iconUrl,
    imageAssetId,
    iconAssetId,
    buttons: showButtons ? previewButtons : [],
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
          <input className="input" id="name" placeholder="e.g. Launch Week" value={name} onChange={(event) => setName(event.target.value)} />
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
          <label htmlFor="contentType">Content taxonomy</label>
          <select className="select" id="contentType" value={contentType} onChange={(event) => setContentType(event.target.value)}>
            {taxonomies.map((taxonomy) => (
              <option key={taxonomy.id} value={taxonomy.slug}>
                {taxonomy.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input className="input" id="title" placeholder="e.g. Weekend Sale" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea className="textarea" id="message" placeholder="Save 30% on last-minute wilderness stays." value={message} onChange={(event) => setMessage(event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="destination">Destination URL</label>
          <input className="input" id="destination" placeholder="https://yoursite.com/landing-page" value={destination} onChange={(event) => setDestination(event.target.value)} />
        </div>

        <div className="grid cards-3">
          <div className="field">
            <label htmlFor="image">Image</label>
            <input className="input" id="image" placeholder="https://yoursite.com/hero.png" value={imageUrl} onChange={(event) => {
              setImageUrl(event.target.value);
              setImageAssetId(null);
            }} />
            <label className="upload-field">
              <span className="upload-field-button">{isUploadingImage ? "Uploading..." : "Upload image"}</span>
              <input type="file" accept="image/*" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)} />
            </label>
            <p className="subtle">{imageFileName ?? "Use a hosted URL or upload a file."}</p>
          </div>
          <div className="field">
            <label htmlFor="icon">Icon</label>
            <input className="input" id="icon" placeholder="https://yoursite.com/icon.png" value={iconUrl} onChange={(event) => {
              setIconUrl(event.target.value);
              setIconAssetId(null);
            }} />
            <label className="upload-field">
              <span className="upload-field-button">{isUploadingIcon ? "Uploading..." : "Upload icon"}</span>
              <input type="file" accept="image/*" onChange={(event) => void handleIconUpload(event.target.files?.[0] ?? null)} />
            </label>
            <p className="subtle">{iconFileName ?? "Optional. Upload a brand icon or keep a URL."}</p>
          </div>
          <div className="field">
            <label htmlFor="schedule">Send time</label>
            <input className="input" id="schedule" type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} />
          </div>
        </div>

        <div className="field">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <label htmlFor="showButtons">Action buttons</label>
            <label htmlFor="showButtons" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input id="showButtons" type="checkbox" checked={showButtons} onChange={(event) => setShowButtons(event.target.checked)} />
              <span>Show buttons</span>
            </label>
          </div>
        </div>

        {showButtons ? (
          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="primaryButtonLabel">Primary button label</label>
              <input
                className="input"
                id="primaryButtonLabel"
                value={primaryButtonLabel}
                onChange={(event) => setPrimaryButtonLabel(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="primaryButtonUrl">Primary button URL</label>
              <input className="input" id="primaryButtonUrl" value={primaryButtonUrl} onChange={(event) => setPrimaryButtonUrl(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="secondaryButtonLabel">Secondary button label</label>
              <input
                className="input"
                id="secondaryButtonLabel"
                value={secondaryButtonLabel}
                onChange={(event) => setSecondaryButtonLabel(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="secondaryButtonUrl">Secondary button URL</label>
              <input className="input" id="secondaryButtonUrl" value={secondaryButtonUrl} onChange={(event) => setSecondaryButtonUrl(event.target.value)} />
            </div>
          </div>
        ) : (
          <div className="card" style={{ boxShadow: "none", background: "var(--surface-raised)" }}>
            <p className="subtle">Action buttons are hidden for this campaign.</p>
          </div>
        )}

        <div className="actions" style={{ justifyContent: "space-between", marginTop: 24 }}>
          <span className="subtle">{statusMessage ?? "Save as draft or schedule when ready."}</span>
          <div className="actions">
            <Link href="/campaigns" className="button secondary">
              Back to campaigns
            </Link>
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
          <div className="preview-image" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} />
          <p className="preview-title">{title}</p>
          <p className="preview-body">{message}</p>
          <p className="subtle" style={{ marginBottom: 8 }}>
            UTM seed: {contentType}
          </p>
          {showButtons ? (
            <div className="actions">
              {previewButtons.map((button) => (
                <button key={`${button.label}-${button.url}`} className="button secondary" type="button">
                  {button.label}
                </button>
              ))}
            </div>
          ) : null}
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
