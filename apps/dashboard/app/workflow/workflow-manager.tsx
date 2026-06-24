"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { postJson } from "../../lib/api-client";
import { useToast } from "../_components/toast";
import type { SiteChoice } from "../_data/sites";
import type {
  WorkflowActionType,
  WorkflowEventSummary,
  WorkflowFeedSummary,
  WorkflowTrigger,
} from "../_data/workflows";

interface WorkflowManagerProps {
  sites: SiteChoice[];
  feeds: WorkflowFeedSummary[];
  events: WorkflowEventSummary[];
}

type FeedStatus = "active" | "paused";

const triggerLabels: Record<WorkflowTrigger, string> = {
  subscriber_registered: "Subscriber registered",
  page_visit: "Page visit",
  click: "Click",
  api_event: "API event",
  rss_item_published: "RSS item published",
};

const actionLabels: Record<WorkflowActionType, string> = {
  send_notification: "Send notification",
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  webhook: "Webhook",
};

function tryParseJson(value: string): Record<string, unknown> {
  if (!value.trim()) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function formatRelative(value: string): string {
  return value || "Not yet polled";
}

// Seed/test sites without a real country on file fall back to the literal
// string "Unknown" -- showing "Site A - Unknown" in a dropdown reads as
// broken data rather than an unset field, so drop the suffix instead.
function formatSiteOptionLabel(site: SiteChoice): string {
  return site.country && site.country !== "Unknown" ? `${site.name} - ${site.country}` : site.name;
}

export function WorkflowManager({ sites: allSites, feeds, events }: WorkflowManagerProps) {
  // RSS feeds and recorded events always belong to one real site -- "All
  // Sites" (site-3) isn't a real site, so picking it here would 404.
  const sites = useMemo(() => allSites.filter((site) => site.id !== "site-3"), [allSites]);
  const router = useRouter();
  const toast = useToast();
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null);
  const [isFeedSubmitting, startFeedTransition] = useTransition();
  const [isEventSubmitting, startEventTransition] = useTransition();
  const [payloadDraft, setPayloadDraft] = useState(
    JSON.stringify(
      {
        source: "dashboard",
        reason: "manual-test",
      },
      null,
      2,
    ),
  );

  const activeFeeds = useMemo(() => feeds.filter((feed) => feed.status === "active").length, [feeds]);
  const pausedFeeds = useMemo(() => feeds.filter((feed) => feed.status === "paused").length, [feeds]);
  const completedEvents = useMemo(() => events.filter((event) => event.status === "completed").length, [events]);

  async function handleCreateFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const siteId = String(form.get("siteId") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const feedUrl = String(form.get("feedUrl") ?? "").trim();
    const status = String(form.get("status") ?? "active") as FeedStatus;

    if (!siteId || !name || !feedUrl) {
      toast.showError("Site, name, and feed URL are required.");
      return;
    }

    startFeedTransition(() => {
      void postJson<{ success: true; data: unknown }>("/api/dashboard/workflow/rss-feeds", {
        siteId,
        name,
        feedUrl,
        status,
      })
        .then(() => {
          toast.showSuccess(`RSS feed "${name}" created.`);
          router.refresh();
          event.currentTarget.reset();
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : "Unable to create RSS feed.");
        });
    });
  }

  async function handleRecordEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const siteId = String(form.get("siteId") ?? "").trim();
    const triggerEvent = String(form.get("triggerEvent") ?? "") as WorkflowTrigger;
    const subscriberIdRaw = String(form.get("subscriberId") ?? "").trim();
    const campaignIdRaw = String(form.get("campaignId") ?? "").trim();

    if (!siteId || !triggerEvent) {
      toast.showError("Site and trigger are required.");
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = tryParseJson(String(form.get("payload") ?? ""));
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : "Payload must be valid JSON.");
      return;
    }

    startEventTransition(() => {
      void postJson<{ success: true; data: unknown }>("/api/dashboard/workflow/events", {
        siteId,
        triggerEvent,
        subscriberId: subscriberIdRaw || null,
        campaignId: campaignIdRaw || null,
        payload,
      })
        .then(() => {
          toast.showSuccess("Workflow event recorded.");
          router.refresh();
          event.currentTarget.reset();
          setPayloadDraft("{}");
        })
        .catch((error) => {
          toast.showError(error instanceof Error ? error.message : "Unable to record workflow event.");
        });
    });
  }

  async function handleFeedAction(feedId: string, nextStatus?: FeedStatus) {
    setBusyFeedId(feedId);

    try {
      if (nextStatus) {
        await postJson(`/api/dashboard/workflow/rss-feeds/${feedId}`, { status: nextStatus }, "PATCH");
      } else {
        await postJson(`/api/dashboard/workflow/rss-feeds/${feedId}/poll`, {}, "POST");
      }
      router.refresh();
      toast.showSuccess(nextStatus ? `Feed ${nextStatus}.` : "Feed polled.");
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : "Unable to update RSS feed.");
    } finally {
      setBusyFeedId(null);
    }
  }

  async function handleDeleteFeed(feedId: string) {
    setBusyFeedId(feedId);
    try {
      await postJson(`/api/dashboard/workflow/rss-feeds/${feedId}`, {}, "DELETE");
      router.refresh();
      toast.showSuccess("Feed removed.");
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : "Unable to delete RSS feed.");
    } finally {
      setBusyFeedId(null);
    }
  }

  return (
    <section className="workflow-manager">
      <div className="workflow-stats">
        <article className="workflow-stat-card">
          <span className="subtle">Active feeds</span>
          <strong>{activeFeeds}</strong>
        </article>
        <article className="workflow-stat-card">
          <span className="subtle">Paused feeds</span>
          <strong>{pausedFeeds}</strong>
        </article>
        <article className="workflow-stat-card">
          <span className="subtle">Completed events</span>
          <strong>{completedEvents}</strong>
        </article>
      </div>

      <div className="workflow-manager-grid">
        <section className="card workflow-panel workflow-panel-strong">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RSS management</p>
              <h3>Turn feeds into campaign triggers.</h3>
            </div>
            <span className="badge active">{activeFeeds} active</span>
          </div>

          <form className="workflow-form" onSubmit={handleCreateFeed}>
            <div className="field">
              <label htmlFor="workflow-feed-site">Site</label>
              <select id="workflow-feed-site" name="siteId" className="select" defaultValue={sites[0]?.id ?? ""}>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {formatSiteOptionLabel(site)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="workflow-feed-name">Feed name</label>
                <input
                  id="workflow-feed-name"
                  name="name"
                  className="input"
                  defaultValue="Travel Updates"
                  placeholder="Feed name"
                />
              </div>
              <div className="field">
                <label htmlFor="workflow-feed-status">Status</label>
                <select id="workflow-feed-status" name="status" className="select" defaultValue="active">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="workflow-feed-url">Feed URL</label>
              <input
                id="workflow-feed-url"
                name="feedUrl"
                className="input"
                defaultValue="https://example.com/feed.xml"
                placeholder="https://example.com/feed.xml"
              />
            </div>

            <div className="actions">
              <button className="button primary" type="submit" disabled={isFeedSubmitting}>
                {isFeedSubmitting ? "Creating..." : "Create RSS feed"}
              </button>
              <span className="subtle">Feeds poll automatically every 15 minutes.</span>
            </div>
          </form>

          <div className="workflow-list-heading">
            <h4>Your feeds</h4>
            <span className="subtle">{feeds.length}</span>
          </div>

          <div className="workflow-feed-list">
            {feeds.length === 0 ? <p className="subtle">No RSS feeds yet -- add one above.</p> : null}
            {feeds.map((feed) => (
              <article key={feed.id} className="workflow-feed-card">
                <div className="workflow-feed-card-header">
                  <div>
                    <strong>{feed.name}</strong>
                    <p className="subtle">{feed.feedUrl}</p>
                  </div>
                  <span className={`badge ${feed.status}`}>{feed.status}</span>
                </div>

                <div className="workflow-feed-meta">
                  <div>
                    <span className="subtle">Last item</span>
                    <strong>{feed.lastItemTitle}</strong>
                  </div>
                  <div>
                    <span className="subtle">Last polled</span>
                    <strong>{formatRelative(feed.lastPolledAt)}</strong>
                  </div>
                </div>

                <div className="actions workflow-feed-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => handleFeedAction(feed.id, feed.status === "active" ? "paused" : "active")}
                    disabled={busyFeedId === feed.id}
                  >
                    {feed.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button className="button secondary" type="button" onClick={() => handleFeedAction(feed.id)} disabled={busyFeedId === feed.id}>
                    {busyFeedId === feed.id ? "Working..." : "Poll now"}
                  </button>
                  <button className="button secondary" type="button" onClick={() => handleDeleteFeed(feed.id)} disabled={busyFeedId === feed.id}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card workflow-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Event logging</p>
              <h3>Manually record automation triggers.</h3>
            </div>
          </div>

          <form className="workflow-form" onSubmit={handleRecordEvent}>
            <div className="field">
              <label htmlFor="workflow-event-site">Site</label>
              <select id="workflow-event-site" name="siteId" className="select" defaultValue={sites[0]?.id ?? ""}>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {formatSiteOptionLabel(site)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="workflow-event-trigger">Trigger</label>
              <select id="workflow-event-trigger" name="triggerEvent" className="select" defaultValue="subscriber_registered">
                {Object.entries(triggerLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="workflow-event-subscriber">Subscriber ID</label>
                <input id="workflow-event-subscriber" name="subscriberId" className="input" placeholder="Optional subscriber ID" />
              </div>
              <div className="field">
                <label htmlFor="workflow-event-campaign">Campaign ID</label>
                <input id="workflow-event-campaign" name="campaignId" className="input" placeholder="Optional campaign ID" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="workflow-event-payload">Payload</label>
              <textarea
                id="workflow-event-payload"
                name="payload"
                className="textarea"
                value={payloadDraft}
                onChange={(event) => setPayloadDraft(event.target.value)}
              />
            </div>

            <div className="actions">
              <button className="button primary" type="submit" disabled={isEventSubmitting}>
                {isEventSubmitting ? "Recording..." : "Record event"}
              </button>
              <span className="subtle">Valid JSON objects are forwarded directly to the workflow engine.</span>
            </div>
          </form>

          <div className="workflow-reference">
            <h4>What an automation can do with this trigger</h4>
            <p className="subtle">
              Set these up on the <Link href="/automations">Automations page</Link> -- this panel only records test events.
            </p>
            <div className="workflow-action-list">
              {Object.entries(actionLabels).map(([value, label]) => (
                <div key={value} className="workflow-action-pill">
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
