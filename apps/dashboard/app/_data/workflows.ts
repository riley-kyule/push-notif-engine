import { apiJson } from "../../lib/server-api";

export type WorkflowTrigger =
  | "subscriber_registered"
  | "page_visit"
  | "click"
  | "api_event"
  | "rss_item_published";

export type WorkflowActionType = "send_notification" | "add_tag" | "remove_tag" | "webhook";

export interface WorkflowFeedSummary {
  id: string;
  siteId: string;
  name: string;
  feedUrl: string;
  status: "active" | "paused";
  lastItemTitle: string;
  lastPolledAt: string;
}

export interface WorkflowEventSummary {
  id: string;
  siteId: string;
  triggerEvent: WorkflowTrigger;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

export interface WorkflowDashboardData {
  feeds: WorkflowFeedSummary[];
  events: WorkflowEventSummary[];
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

const fallbackFeeds: WorkflowFeedSummary[] = [
  {
    id: "rss-1",
    siteId: "site-1",
    name: "Site News",
    feedUrl: "https://example.com/feed.xml",
    status: "active",
    lastItemTitle: "Latest update",
    lastPolledAt: "2026-06-20 08:15",
  },
  {
    id: "rss-2",
    siteId: "site-2",
    name: "Editorial Picks",
    feedUrl: "https://example.com/editorial.xml",
    status: "paused",
    lastItemTitle: "Weekend feature roundup",
    lastPolledAt: "2026-06-19 17:30",
  },
];

const fallbackEvents: WorkflowEventSummary[] = [
  {
    id: "event-1",
    siteId: "site-1",
    triggerEvent: "subscriber_registered",
    status: "completed",
    errorMessage: null,
    createdAt: "2026-06-20 08:20",
  },
  {
    id: "event-2",
    siteId: "site-1",
    triggerEvent: "rss_item_published",
    status: "pending",
    errorMessage: null,
    createdAt: "2026-06-20 08:30",
  },
  {
    id: "event-3",
    siteId: "site-2",
    triggerEvent: "api_event",
    status: "failed",
    errorMessage: "Webhook returned HTTP 500",
    createdAt: "2026-06-19 19:10",
  },
];

function buildFallback(): WorkflowDashboardData {
  return {
    feeds: fallbackFeeds,
    events: fallbackEvents,
  };
}

export async function getWorkflowDashboardData(): Promise<WorkflowDashboardData> {
  const [feedsResponse, eventsResponse] = await Promise.all([
    apiJson<ApiResponse<{ items: WorkflowFeedSummary[] }>>("/workflow/rss-feeds"),
    apiJson<ApiResponse<{ items: WorkflowEventSummary[] }>>("/workflow/events"),
  ]);

  if (feedsResponse?.data.items && eventsResponse?.data.items) {
    return {
      feeds: feedsResponse.data.items,
      events: eventsResponse.data.items,
    };
  }

  return buildFallback();
}

export function getFallbackWorkflowDashboardData(): WorkflowDashboardData {
  return buildFallback();
}
