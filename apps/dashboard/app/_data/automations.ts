import { apiJson } from "../../lib/server-api";

export type AutomationTriggerEvent = "subscriber_registered" | "page_visit" | "click" | "api_event" | "rss_item_published";
export type AutomationStatus = "active" | "paused";
export type AutomationActionType = "send_notification" | "add_tag" | "remove_tag" | "webhook";

export interface AutomationSummary {
  id: string;
  siteId: string;
  name: string;
  triggerEvent: AutomationTriggerEvent;
  status: AutomationStatus;
  actionCount: number;
  title: string;
  message: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface AutomationApiRecord extends AutomationSummary {
  actions?: unknown[];
}

interface AutomationApiResponse<T> {
  success: true;
  data: T;
}

const fallbackAutomations: AutomationSummary[] = [
  {
    id: "automation-1",
    siteId: "site-1",
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    status: "active",
    actionCount: 2,
    title: "Welcome",
    message: "Thanks for subscribing.",
    url: "https://example.com/welcome",
    createdAt: "2026-06-20T08:00:00.000Z",
    updatedAt: "2026-06-20T08:00:00.000Z",
  },
  {
    id: "automation-2",
    siteId: "site-1",
    name: "RSS article alert",
    triggerEvent: "rss_item_published",
    status: "paused",
    actionCount: 1,
    title: "New article published",
    message: "Check the latest update.",
    url: "https://example.com/news/latest",
    createdAt: "2026-06-19T10:00:00.000Z",
    updatedAt: "2026-06-19T10:00:00.000Z",
  },
];

export async function getAutomationSummaries(): Promise<AutomationSummary[]> {
  const response = await apiJson<AutomationApiResponse<{ items: AutomationApiRecord[] }>>("/automations");
  const items = (response?.data.items ?? fallbackAutomations) as AutomationApiRecord[];
  return items.map((item) => ({
    id: item.id,
    siteId: item.siteId,
    name: item.name,
    triggerEvent: item.triggerEvent,
    status: item.status,
    actionCount: item.actionCount ?? (Array.isArray(item.actions) ? item.actions.length : 0),
    title: item.title,
    message: item.message,
    url: item.url,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export function getFallbackAutomations(): AutomationSummary[] {
  return fallbackAutomations;
}
