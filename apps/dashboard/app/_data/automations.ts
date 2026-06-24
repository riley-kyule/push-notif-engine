import { apiJson } from "../../lib/server-api";

export type AutomationTriggerEvent =
  | "subscriber_registered"
  | "subscriber_unsubscribed"
  | "page_visit"
  | "click"
  | "api_event"
  | "rss_item_published";
export type AutomationStatus = "active" | "paused";
export type AutomationActionType = "send_notification" | "add_tag" | "remove_tag" | "webhook";

export interface AutomationSummary {
  id: string;
  siteId: string | null;
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

export interface AutomationListPayload {
  items: AutomationSummary[];
  total: number;
}

export interface AutomationListFilters {
  limit?: number | undefined;
  offset?: number | undefined;
  siteId?: string | null | undefined;
  status?: AutomationStatus | undefined;
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

export async function getAutomationSummaries(filters: AutomationListFilters = {}): Promise<AutomationListPayload> {
  const search = new URLSearchParams();
  search.set("limit", String(filters.limit ?? 25));
  search.set("offset", String(filters.offset ?? 0));
  if (filters.siteId !== undefined && filters.siteId !== null) {
    search.set("siteId", filters.siteId);
  } else if (filters.siteId === null) {
    search.set("siteId", "");
  }
  if (filters.status) {
    search.set("status", filters.status);
  }

  const response = await apiJson<AutomationApiResponse<{ items: AutomationApiRecord[]; total: number }>>(`/automations?${search.toString()}`);
  if (!response?.data?.items) {
    const items = fallbackAutomations
      .filter((item) => filters.status ? item.status === filters.status : true)
      .slice(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 25));
    return { items, total: fallbackAutomations.filter((item) => (filters.status ? item.status === filters.status : true)).length };
  }

  const items = response.data.items.map((item) => ({
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
  return { items, total: response.data.total };
}

export function getFallbackAutomations(): AutomationSummary[] {
  return fallbackAutomations;
}
