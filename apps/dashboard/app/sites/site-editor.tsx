"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { uploadMedia } from "../../lib/upload-media";

type SiteEditorMode = "create" | "edit";

interface SiteFormValues {
  name: string;
  url: string;
  country: string;
  language: string;
  platform: string;
  status: "active" | "inactive";
  vapidPublicKey: string;
  appName: string;
  iconUrl: string;
  themeColor: string;
  optInPromptType: "lightbox-1" | "lightbox-2" | "bell-icon";
  optInPromptAnimation: "slide-in" | "fade-in" | "pop";
  optInPromptBackgroundColor: string;
  optInPromptHeadline: string;
  optInPromptHeadlineTextColor: string;
  optInPromptText: string;
  optInPromptTextColor: string;
  optInPromptIconUrl: string;
  optInPromptCancelButtonLabel: string;
  optInPromptCancelButtonTextColor: string;
  optInPromptCancelButtonBackgroundColor: string;
  optInPromptApproveButtonLabel: string;
  optInPromptApproveButtonTextColor: string;
  optInPromptApproveButtonBackgroundColor: string;
  optInPromptRepromptDelayDays: number;
  optInPromptRecentNotificationsLimit: number;
}

const platformOptions = ["WordPress", "Laravel", "Node.js", "Magento", "Other"] as const;
const statusOptions = ["active", "inactive"] as const;
const promptTemplates = [
  { value: "lightbox-1", label: "Lightbox 1", description: "Top sheet on desktop, bottom sheet on mobile" },
  { value: "lightbox-2", label: "Lightbox 2", description: "Centered interstitial" },
  { value: "bell-icon", label: "Bell Icon", description: "Bottom-left launcher" },
] as const;

export function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  if (error && typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function buildSiteRequestBody(values: SiteFormValues): Record<string, unknown> {
  return {
    ...values,
    url: normalizeSiteUrl(values.url),
    vapidPublicKey: values.vapidPublicKey.trim() ? values.vapidPublicKey.trim() : null,
  };
}

export function validateSiteForm(values: SiteFormValues): string | null {
  if (values.name.trim().length < 2) {
    return "Site name must be at least 2 characters.";
  }

  if (!values.url.trim()) {
    return "Site URL is required.";
  }

  if (values.country.trim().length < 2) {
    return "Country is required.";
  }

  if (values.language.trim().length < 2) {
    return "Language is required.";
  }

  if (!values.platform.trim()) {
    return "Platform is required.";
  }

  return null;
}

function PromptPreview({ values }: { values: SiteFormValues }) {
  const isBell = values.optInPromptType === "bell-icon";
  const isLightboxTwo = values.optInPromptType === "lightbox-2";
  const isLightboxOne = values.optInPromptType === "lightbox-1";

  return (
    <div
      style={{
        minHeight: 360,
        borderRadius: 24,
        border: "1px solid var(--border)",
        background: "linear-gradient(180deg, rgba(15, 23, 42, 0.03), rgba(15, 23, 42, 0.02))",
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top left, rgba(234, 88, 12, 0.08), transparent 30%), radial-gradient(circle at bottom right, rgba(2, 132, 199, 0.08), transparent 30%)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, height: "100%", minHeight: 328, display: "grid" }}>
        <div
          style={{
            alignSelf: isLightboxTwo ? "center" : isBell ? "end" : "start",
            justifySelf: isBell ? "start" : "stretch",
            width: isBell ? 58 : "100%",
            maxWidth: isBell ? 58 : 520,
            borderRadius: isBell ? "999px" : 24,
            display: "grid",
            placeItems: isBell ? "center" : "stretch",
            background: isBell ? values.optInPromptApproveButtonBackgroundColor : values.optInPromptBackgroundColor,
            color: values.optInPromptHeadlineTextColor,
            boxShadow: "0 18px 36px rgba(15, 23, 42, 0.16)",
            padding: isBell ? 0 : 20,
          }}
        >
          {isBell ? (
            <span style={{ fontSize: 24, lineHeight: 1 }}>🔔</span>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="subtle" style={{ margin: 0 }}>
                {isLightboxOne ? "Desktop top sheet / mobile bottom sheet" : "Centered interstitial"}
              </div>
              <div className="grid" style={{ gridTemplateColumns: "56px minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "rgba(15, 23, 42, 0.06)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {values.optInPromptIconUrl ? (
                    <img src={values.optInPromptIconUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                  ) : (
                    <span className="subtle">Icon</span>
                  )}
                </div>
                <div className="grid" style={{ gap: 8 }}>
                  <strong style={{ color: values.optInPromptHeadlineTextColor, fontSize: 18, lineHeight: 1.2 }}>
                    {values.optInPromptHeadline || "Stay in the loop"}
                  </strong>
                  <p style={{ margin: 0, color: values.optInPromptTextColor }}>
                    {values.optInPromptText || "Get important updates delivered to your browser."}
                  </p>
                </div>
              </div>
              <div className="actions" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="button secondary"
                  style={{
                    background: values.optInPromptCancelButtonBackgroundColor,
                    color: values.optInPromptCancelButtonTextColor,
                  }}
                >
                  {values.optInPromptCancelButtonLabel || "Not now"}
                </button>
                <button
                  type="button"
                  className="button primary"
                  style={{
                    background: values.optInPromptApproveButtonBackgroundColor,
                    color: values.optInPromptApproveButtonTextColor,
                  }}
                >
                  {values.optInPromptApproveButtonLabel || "Enable"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function submitSite(mode: SiteEditorMode, id: string | null, values: SiteFormValues): Promise<void> {
  const response = await fetch(mode === "create" ? "/api/dashboard/sites" : `/api/dashboard/sites/${id ?? ""}`, {
    method: mode === "create" ? "POST" : "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(buildSiteRequestBody(values)),
  });

  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, "Unable to save site"));
  }
}

export function SiteEditor({
  mode,
  siteId,
  initialValues,
}: {
  mode: SiteEditorMode;
  siteId?: string | null;
  initialValues: SiteFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SiteFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isUploadingPromptIcon, setIsUploadingPromptIcon] = useState(false);

  function updateField<K extends keyof SiteFormValues>(key: K, value: SiteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  // Uploads need a real site id to attach the asset to, so this is only
  // available once a site exists -- i.e. in edit mode, not while creating one.
  async function handleIconUpload(file: File | null) {
    if (!file || !siteId) {
      return;
    }

    setIsUploadingIcon(true);
    setError(null);
    try {
      const asset = await uploadMedia(siteId, "icon", file);
      updateField("iconUrl", asset.publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload icon");
    } finally {
      setIsUploadingIcon(false);
    }
  }

  async function handlePromptIconUpload(file: File | null) {
    if (!file || !siteId) {
      return;
    }

    setIsUploadingPromptIcon(true);
    setError(null);
    try {
      const asset = await uploadMedia(siteId, "icon", file);
      updateField("optInPromptIconUrl", asset.publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload icon");
    } finally {
      setIsUploadingPromptIcon(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateSiteForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(() => {
      void submitSite(mode, siteId ?? null, values)
        .then(() => {
          router.push("/sites");
          router.refresh();
        })
        .catch((submitError) => {
          setError(submitError instanceof Error ? submitError.message : "Unable to save site");
        });
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="name">Site name</label>
        <input id="name" className="input" value={values.name} onChange={(e) => updateField("name", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="url">Site URL</label>
        <input id="url" className="input" value={values.url} onChange={(e) => updateField("url", e.target.value)} />
        <p className="subtle" style={{ marginTop: 8 }}>
          Paste a site hostname or full URL. `https://` will be added automatically when needed.
        </p>
      </div>
      <div className="grid cards-3">
        <div className="field">
          <label htmlFor="country">Country</label>
          <input id="country" className="input" value={values.country} onChange={(e) => updateField("country", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="language">Language</label>
          <input id="language" className="input" value={values.language} onChange={(e) => updateField("language", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" className="select" value={values.status} onChange={(e) => updateField("status", e.target.value as SiteFormValues["status"])}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid cards-2">
        <div className="field">
          <label htmlFor="platform">Platform</label>
          <select id="platform" className="select" value={values.platform} onChange={(e) => updateField("platform", e.target.value)}>
            {platformOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="vapidPublicKey">VAPID public key</label>
          <input
            id="vapidPublicKey"
            className="input"
            value={values.vapidPublicKey}
            onChange={(e) => updateField("vapidPublicKey", e.target.value)}
            placeholder="Optional for local onboarding"
          />
        </div>
      </div>
      <div className="grid cards-3">
        <div className="field">
          <label htmlFor="appName">App name</label>
          <input id="appName" className="input" value={values.appName} onChange={(e) => updateField("appName", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="iconUrl">Icon URL</label>
          <input
            id="iconUrl"
            className="input"
            value={values.iconUrl}
            onChange={(e) => updateField("iconUrl", e.target.value)}
            placeholder="https://example.com/icon.png"
          />
          {siteId ? (
            <label className="upload-field">
              <span className="upload-field-button">{isUploadingIcon ? "Uploading..." : "Upload icon"}</span>
              <input type="file" accept="image/*" onChange={(e) => void handleIconUpload(e.target.files?.[0] ?? null)} />
            </label>
          ) : (
            <p className="subtle" style={{ marginTop: 8 }}>
              Save the site first to upload an icon instead of pasting a URL.
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="themeColor">Theme color</label>
          <input
            id="themeColor"
            className="input"
            value={values.themeColor}
            onChange={(e) => updateField("themeColor", e.target.value)}
            placeholder="#1c1917"
          />
        </div>
      </div>
      <div className="card" style={{ background: "var(--surface-raised)" }}>
        <div className="grid" style={{ gap: 18 }}>
          <div className="field">
            <label>Opt-in prompt type</label>
            <div className="grid cards-3">
              {promptTemplates.map((template) => {
                const selected = values.optInPromptType === template.value;
                return (
                  <button
                    key={template.value}
                    type="button"
                    className="card"
                    onClick={() => updateField("optInPromptType", template.value)}
                    style={{
                      margin: 0,
                      textAlign: "left",
                      borderColor: selected ? "var(--primary)" : "var(--border)",
                      boxShadow: selected ? "0 0 0 1px var(--primary) inset" : "none",
                      background: selected ? "rgba(234, 88, 12, 0.04)" : "var(--surface)",
                    }}
                  >
                    <p className="subtle" style={{ marginBottom: 6 }}>
                      Template
                    </p>
                    <p className="stat" style={{ marginBottom: 4 }}>
                      {template.label}
                    </p>
                    <p className="subtle">{template.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="optInPromptAnimation">Animation</label>
              <select
                id="optInPromptAnimation"
                className="select"
                value={values.optInPromptAnimation}
                onChange={(e) => updateField("optInPromptAnimation", e.target.value as SiteFormValues["optInPromptAnimation"])}
              >
                <option value="slide-in">Slide-in</option>
                <option value="fade-in">Fade-in</option>
                <option value="pop">Pop</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="optInPromptRepromptDelayDays">Re-prompt delay days</label>
              <input
                id="optInPromptRepromptDelayDays"
                className="input"
                type="number"
                min={0}
                value={values.optInPromptRepromptDelayDays}
                onChange={(e) => updateField("optInPromptRepromptDelayDays", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="optInPromptRecentNotificationsLimit">Recent notifications shown in bell tray</label>
              <input
                id="optInPromptRecentNotificationsLimit"
                className="input"
                type="number"
                min={1}
                max={10}
                value={values.optInPromptRecentNotificationsLimit}
                onChange={(e) => updateField("optInPromptRecentNotificationsLimit", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="optInPromptBackgroundColor">Background color</label>
              <input
                id="optInPromptBackgroundColor"
                className="input"
                value={values.optInPromptBackgroundColor}
                onChange={(e) => updateField("optInPromptBackgroundColor", e.target.value)}
                placeholder="#ffffff"
              />
            </div>
            <div className="field">
              <label htmlFor="optInPromptIconUrl">Prompt icon URL</label>
              <input
                id="optInPromptIconUrl"
                className="input"
                value={values.optInPromptIconUrl}
                onChange={(e) => updateField("optInPromptIconUrl", e.target.value)}
                placeholder="https://example.com/prompt-icon.png"
              />
              {siteId ? (
                <label className="upload-field">
                  <span className="upload-field-button">{isUploadingPromptIcon ? "Uploading..." : "Upload icon"}</span>
                  <input type="file" accept="image/*" onChange={(e) => void handlePromptIconUpload(e.target.files?.[0] ?? null)} />
                </label>
              ) : (
                <p className="subtle" style={{ marginTop: 8 }}>
                  Save the site first to upload an icon instead of pasting a URL.
                </p>
              )}
            </div>
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="optInPromptHeadline">Headline</label>
              <input
                id="optInPromptHeadline"
                className="input"
                value={values.optInPromptHeadline}
                onChange={(e) => updateField("optInPromptHeadline", e.target.value)}
                placeholder="Stay up to date"
              />
            </div>
            <div className="field">
              <label htmlFor="optInPromptText">Body text</label>
              <textarea
                id="optInPromptText"
                className="input"
                rows={3}
                value={values.optInPromptText}
                onChange={(e) => updateField("optInPromptText", e.target.value)}
                placeholder="Choose how you'd like to hear from us."
              />
            </div>
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="optInPromptHeadlineTextColor">Headline text color</label>
              <input
                id="optInPromptHeadlineTextColor"
                className="input"
                value={values.optInPromptHeadlineTextColor}
                onChange={(e) => updateField("optInPromptHeadlineTextColor", e.target.value)}
                placeholder="#111111"
              />
            </div>
            <div className="field">
              <label htmlFor="optInPromptTextColor">Prompt text color</label>
              <input
                id="optInPromptTextColor"
                className="input"
                value={values.optInPromptTextColor}
                onChange={(e) => updateField("optInPromptTextColor", e.target.value)}
                placeholder="#444444"
              />
            </div>
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="optInPromptCancelButtonLabel">Cancel button</label>
              <input
                id="optInPromptCancelButtonLabel"
                className="input"
                value={values.optInPromptCancelButtonLabel}
                onChange={(e) => updateField("optInPromptCancelButtonLabel", e.target.value)}
                placeholder="Not now"
              />
            </div>
            <div className="field">
              <label htmlFor="optInPromptApproveButtonLabel">Approve button</label>
              <input
                id="optInPromptApproveButtonLabel"
                className="input"
                value={values.optInPromptApproveButtonLabel}
                onChange={(e) => updateField("optInPromptApproveButtonLabel", e.target.value)}
                placeholder="Enable"
              />
            </div>
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="optInPromptCancelButtonBackgroundColor">Cancel button background</label>
              <input
                id="optInPromptCancelButtonBackgroundColor"
                className="input"
                value={values.optInPromptCancelButtonBackgroundColor}
                onChange={(e) => updateField("optInPromptCancelButtonBackgroundColor", e.target.value)}
                placeholder="#111111"
              />
            </div>
            <div className="field">
              <label htmlFor="optInPromptApproveButtonBackgroundColor">Approve button background</label>
              <input
                id="optInPromptApproveButtonBackgroundColor"
                className="input"
                value={values.optInPromptApproveButtonBackgroundColor}
                onChange={(e) => updateField("optInPromptApproveButtonBackgroundColor", e.target.value)}
                placeholder="#ea580c"
              />
            </div>
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="optInPromptCancelButtonTextColor">Cancel button text</label>
              <input
                id="optInPromptCancelButtonTextColor"
                className="input"
                value={values.optInPromptCancelButtonTextColor}
                onChange={(e) => updateField("optInPromptCancelButtonTextColor", e.target.value)}
                placeholder="#ffffff"
              />
            </div>
            <div className="field">
              <label htmlFor="optInPromptApproveButtonTextColor">Approve button text</label>
              <input
                id="optInPromptApproveButtonTextColor"
                className="input"
                value={values.optInPromptApproveButtonTextColor}
                onChange={(e) => updateField("optInPromptApproveButtonTextColor", e.target.value)}
                placeholder="#ffffff"
              />
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: 18 }}>
            <article className="card" style={{ margin: 0, background: "var(--surface)" }}>
              <p className="subtle">Preview</p>
              <PromptPreview values={values} />
            </article>
            <article className="card" style={{ margin: 0, background: "var(--surface)" }}>
              <p className="subtle">Summary</p>
              <p className="stat">{values.optInPromptType.replace("-", " ")}</p>
              <p className="subtle">{values.optInPromptAnimation} animation</p>
              <p className="subtle">Reprompt after {values.optInPromptRepromptDelayDays} day(s)</p>
              <p className="subtle">Recent notifications: {values.optInPromptRecentNotificationsLimit}</p>
            </article>
          </div>
        </div>
      </div>
      {error ? <p className="badge failed" style={{ justifyContent: "flex-start" }}>{error}</p> : null}
      <div className="actions">
        <button className="button primary" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : mode === "create" ? "Create site" : "Update site"}
        </button>
      </div>
    </form>
  );
}
