"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "../../lib/api-client";
import { useToast } from "../_components/toast";
import type { SiteChoice } from "../_data/sites";
import type { AutomationStatus, AutomationSummary, AutomationTriggerEvent } from "../_data/automations";

const triggerLabels: Record<AutomationTriggerEvent, string> = {
  subscriber_registered: "Subscriber registered",
  subscriber_unsubscribed: "Subscriber unsubscribed",
  page_visit: "Page visit",
  click: "Click",
  api_event: "API event",
  rss_item_published: "RSS item published",
};

const ALL_SITES_VALUE = "__all_sites__";

export function formatAutomationScope(siteId: string | null, sites: SiteChoice[]): string {
  if (siteId === null) {
    return "Inherited from All Sites";
  }

  return sites.find((site) => site.id === siteId)?.name ?? siteId;
}

export function AutomationManager({ sites, automations }: { sites: SiteChoice[]; automations: AutomationSummary[] }) {
  const router = useRouter();
  const realSites = sites.filter((site) => site.id !== "site-3");

  const defaultSiteId = realSites[0]?.id ?? "";
  const [siteId, setSiteId] = useState(defaultSiteId);
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerEvent>("subscriber_registered");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [status, setStatus] = useState<AutomationStatus>("active");
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);

  const toast = useToast();
  const [defaultsSiteId, setDefaultsSiteId] = useState(ALL_SITES_VALUE);
  const [busyAutomationId, setBusyAutomationId] = useState<string | null>(null);
  const [isCreating, startCreate] = useTransition();
  const [isSeeding, startSeed] = useTransition();

  function resetForm() {
    setEditingAutomationId(null);
    setSiteId(defaultSiteId);
    setName("");
    setTriggerEvent("subscriber_registered");
    setTitle("");
    setMessage("");
    setUrl("");
    setImageUrl("");
    setIconUrl("");
    setStatus("active");
  }

  function beginEdit(automation: AutomationSummary) {
    setEditingAutomationId(automation.id);
    setSiteId(automation.siteId ?? ALL_SITES_VALUE);
    setName(automation.name);
    setTriggerEvent(automation.triggerEvent);
    setTitle(automation.title);
    setMessage(automation.message);
    setUrl(automation.url);
    setImageUrl("");
    setIconUrl("");
    setStatus(automation.status);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!siteId || !name.trim() || !title.trim() || !message.trim() || !url.trim()) {
      toast.showError("Site, name, title, message, and URL are required.");
      return;
    }

    startCreate(() => {
      const payload = {
        siteId: siteId === ALL_SITES_VALUE ? null : siteId,
        name: name.trim(),
        triggerEvent,
        title: title.trim(),
        message: message.trim(),
        url: url.trim(),
        imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
        iconUrl: iconUrl.trim() ? iconUrl.trim() : null,
        status,
      };
      const isEditing = editingAutomationId !== null;
      const endpoint = isEditing ? `/api/dashboard/automations/${editingAutomationId}` : "/api/dashboard/automations";
      void postJson(endpoint, payload, isEditing ? "PATCH" : "POST")
        .then(() => {
          toast.showSuccess(isEditing ? `Automation "${name.trim()}" updated.` : `Automation "${name.trim()}" created.`);
          resetForm();
          router.refresh();
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : isEditing ? "Unable to update automation." : "Unable to create automation.");
        });
    });
  }

  function handleSeedDefaults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSeed(() => {
      void postJson<{ data: unknown[] }>("/api/dashboard/automations/seed-defaults", {
        siteId: defaultsSiteId === ALL_SITES_VALUE ? null : defaultsSiteId,
      })
        .then((result) => {
          const createdCount = Array.isArray(result?.data) ? result.data.length : 0;
          if (createdCount > 0) {
            toast.showSuccess(`Created ${createdCount} default automation${createdCount === 1 ? "" : "s"}.`);
          } else {
            toast.showToast(
              defaultsSiteId === ALL_SITES_VALUE
                ? "A welcome push already covers all sites -- find it in the Automation library below and edit it directly if its title or URL need changing."
                : "Defaults already exist for this site -- find it in the Automation library below and edit it directly if it needs changing.",
              "info",
            );
          }
          router.refresh();
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : "Unable to set up default automations.");
        });
    });
  }

  function toggleStatus(automation: AutomationSummary) {
    setBusyAutomationId(automation.id);
    const nextStatus = automation.status === "active" ? "paused" : "active";
    void postJson(`/api/dashboard/automations/${automation.id}`, { status: nextStatus }, "PATCH")
      .then(() => {
        toast.showSuccess(`"${automation.name}" ${nextStatus}.`);
        router.refresh();
      })
      .catch((error) => {
        toast.showError(error instanceof Error ? error.message : "Unable to update automation.");
      })
      .finally(() => {
        setBusyAutomationId(null);
      });
  }

  function deleteAutomation(automation: AutomationSummary) {
    if (!window.confirm(`Delete "${automation.name}"? This can't be undone.`)) {
      return;
    }

    setBusyAutomationId(automation.id);
    void postJson(`/api/dashboard/automations/${automation.id}`, undefined, "DELETE")
      .then(() => {
        toast.showSuccess(`Automation "${automation.name}" deleted.`);
        router.refresh();
      })
      .catch((error) => {
        toast.showError(error instanceof Error ? error.message : "Unable to delete automation.");
      })
      .finally(() => {
        setBusyAutomationId(null);
      });
  }

  function formatDate(value: string): string {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <section className="card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Quick start</p>
            <h3>Set up default automations</h3>
          </div>
        </div>
        <p className="subtle">
          Creates the welcome push for new subscribers. Unsubscribe handling stays on the site as a tooltip or help
          cue, not as a push notification. Use All Sites to apply the welcome rule to future sites too. Safe to run
          more than once.
        </p>
        <form onSubmit={handleSeedDefaults} className="grid cards-2" style={{ marginTop: 12, alignItems: "end" }}>
          <div className="field">
            <label htmlFor="defaults-site">Site</label>
            <select
              id="defaults-site"
              className="select"
              value={defaultsSiteId}
              onChange={(event) => setDefaultsSiteId(event.target.value)}
            >
              <option value={ALL_SITES_VALUE}>All Sites (seed every site)</option>
              {realSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <button className="button secondary" type="submit" disabled={isSeeding}>
            {isSeeding ? "Setting up..." : "Set up default automations"}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{editingAutomationId ? "Edit rule" : "New rule"}</p>
            <h3>{editingAutomationId ? "Edit automation" : "Create automation"}</h3>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: 14, marginTop: 12 }}>
          <div className="grid cards-3">
            <div className="field">
              <label htmlFor="automation-site">Site</label>
              <select id="automation-site" className="select" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                <option value={ALL_SITES_VALUE}>All Sites (every site, including new ones)</option>
                {realSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="automation-trigger">Trigger</label>
              <select
                id="automation-trigger"
                className="select"
                value={triggerEvent}
                onChange={(event) => setTriggerEvent(event.target.value as AutomationTriggerEvent)}
              >
                {Object.entries(triggerLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="automation-status">Status</label>
              <select id="automation-status" className="select" value={status} onChange={(event) => setStatus(event.target.value as AutomationStatus)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="automation-name">Name</label>
            <input id="automation-name" className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Welcome push" />
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="automation-title">Notification title</label>
              <input id="automation-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Welcome!" />
            </div>
            <div className="field">
              <label htmlFor="automation-url">Destination URL</label>
              <input id="automation-url" className="input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://yoursite.com" />
              {siteId === ALL_SITES_VALUE ? (
                <p className="subtle">
                  Applies to every site, so use {"{{site_name}}"} and {"{{site_url}}"} here (and in the title) instead of one
                  fixed site -- each subscriber's own site is filled in when the push actually sends.
                </p>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="automation-message">Notification message</label>
            <textarea
              id="automation-message"
              className="textarea"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Thanks for subscribing - we'll keep you posted."
            />
          </div>

          <div className="grid cards-2">
            <div className="field">
              <label htmlFor="automation-image">Image URL (optional)</label>
              <input id="automation-image" className="input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="automation-icon">Icon URL (optional)</label>
              <input id="automation-icon" className="input" value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} />
            </div>
          </div>

          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button className="button primary" type="submit" disabled={isCreating}>
              {isCreating ? (editingAutomationId ? "Saving..." : "Creating...") : editingAutomationId ? "Save changes" : "Create automation"}
            </button>
            {editingAutomationId ? (
              <button className="button secondary" type="button" onClick={cancelEdit} disabled={isCreating}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>


      <section className="card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Rule engine</p>
            <h3>Automation library</h3>
          </div>
          <span className="badge active">Live from API</span>
        </div>

        <div className="workflow-feed-list">
          {automations.map((automation) => {
            const isBusy = busyAutomationId === automation.id;
            return (
              <article key={automation.id} className="workflow-feed-card">
                <div className="workflow-feed-card-header">
                  <div>
                    <strong>{automation.name}</strong>
                    <p className="subtle">{automation.title}</p>
                  </div>
                  <div className="actions" style={{ alignItems: "center" }}>
                    {automation.siteId === null ? <span className="badge neutral">Inherited</span> : null}
                    <span className={`badge ${automation.status}`}>{automation.status}</span>
                  </div>
                </div>

                <div className="workflow-feed-meta">
                  <div>
                    <span className="subtle">Scope</span>
                    <strong>{formatAutomationScope(automation.siteId, sites)}</strong>
                  </div>
                  <div>
                    <span className="subtle">Trigger</span>
                    <strong>{triggerLabels[automation.triggerEvent] ?? automation.triggerEvent.replaceAll("_", " ")}</strong>
                  </div>
                  <div>
                    <span className="subtle">Actions</span>
                    <strong>{automation.actionCount}</strong>
                  </div>
                  <div>
                    <span className="subtle">Updated</span>
                    <strong>{formatDate(automation.updatedAt)}</strong>
                  </div>
                </div>

                <p className="subtle">{automation.message}</p>
                <p className="subtle mono">{automation.url}</p>

                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="button secondary" type="button" disabled={isBusy} onClick={() => beginEdit(automation)}>
                    Edit
                  </button>
                  <button className="button secondary" type="button" disabled={isBusy} onClick={() => toggleStatus(automation)}>
                    {automation.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button className="button secondary" type="button" disabled={isBusy} onClick={() => deleteAutomation(automation)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
          {automations.length === 0 ? <p className="subtle">No automations yet -- create one above.</p> : null}
        </div>
      </section>
    </div>
  );
}
