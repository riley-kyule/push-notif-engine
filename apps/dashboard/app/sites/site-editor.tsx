"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SiteEditorMode = "create" | "edit";

interface SiteFormValues {
  name: string;
  url: string;
  country: string;
  language: string;
  platform: string;
  status: "active" | "inactive";
  subscribers: number;
  vapidPublicKey: string;
}

const platformOptions = ["WordPress", "Laravel", "Node.js", "Magento", "Other"] as const;
const statusOptions = ["active", "inactive"] as const;

async function submitSite(mode: SiteEditorMode, id: string | null, values: SiteFormValues): Promise<void> {
  const response = await fetch(mode === "create" ? "/api/dashboard/sites" : `/api/dashboard/sites/${id ?? ""}`, {
    method: mode === "create" ? "POST" : "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...values,
      subscribers: Number(values.subscribers),
      vapidPublicKey: values.vapidPublicKey.trim() ? values.vapidPublicKey.trim() : null,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to save site");
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

  function updateField<K extends keyof SiteFormValues>(key: K, value: SiteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
    <form onSubmit={handleSubmit} className="grid" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="name">Site name</label>
        <input id="name" className="input" value={values.name} onChange={(e) => updateField("name", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="url">Site URL</label>
        <input id="url" className="input" value={values.url} onChange={(e) => updateField("url", e.target.value)} />
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
      <div className="grid cards-3">
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
          <label htmlFor="subscribers">Subscribers</label>
          <input
            id="subscribers"
            className="input"
            type="number"
            min={0}
            value={values.subscribers}
            onChange={(e) => updateField("subscribers", Number(e.target.value))}
          />
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
      {error ? <p className="badge failed" style={{ justifyContent: "flex-start" }}>{error}</p> : null}
      <div className="actions">
        <button className="button primary" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : mode === "create" ? "Create site" : "Update site"}
        </button>
      </div>
    </form>
  );
}
