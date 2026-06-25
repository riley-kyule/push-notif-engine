import { apiJson } from "../../lib/server-api";

export interface SubscriberHistoryItem {
  id: string;
  campaign: string;
  status: "sent" | "delivered" | "failed" | "clicked";
  channel: "web" | "mobile";
  timestamp: string;
}

export interface SubscriberSummary {
  id: string;
  siteId: string;
  endpoint: string;
  browser: string;
  deviceType: string;
  country: string;
  language: string;
  status: "active" | "inactive" | "unsubscribed" | "expired";
  lastSeenAt: string | null;
  createdAt: string;
  historyCount: number;
}

export interface SubscriberDetail extends SubscriberSummary {
  history: SubscriberHistoryItem[];
}

export interface SubscriberListPayload {
  items: SubscriberSummary[];
  total: number;
}

interface SubscriberApiResponse<T> {
  success: true;
  data: T;
}

// Only rendered when the /subscribers API is unreachable.
const fallbackSubscribers: SubscriberDetail[] = [
  {
    id: "subscriber-1",
    siteId: "site-1",
    endpoint: "https://fcm.googleapis.com/fcm/send/epe-1",
    browser: "Chrome",
    deviceType: "mobile",
    country: "Unknown",
    language: "en",
    status: "active",
    lastSeenAt: "2026-06-16 08:40",
    createdAt: "2026-06-12 14:20",
    historyCount: 3,
    history: [
      { id: "history-1", campaign: "Launch Week", status: "delivered", channel: "web", timestamp: "2026-06-16 08:30" },
      { id: "history-2", campaign: "Weekend Sale", status: "clicked", channel: "web", timestamp: "2026-06-15 11:10" },
      { id: "history-3", campaign: "Weekly Roundup", status: "sent", channel: "web", timestamp: "2026-06-14 09:00" },
    ],
  },
  {
    id: "subscriber-2",
    siteId: "site-1",
    endpoint: "https://updates.push.apple.com/3/device/epe-2",
    browser: "Safari",
    deviceType: "desktop",
    country: "Unknown",
    language: "en",
    status: "active",
    lastSeenAt: "2026-06-15 15:05",
    createdAt: "2026-06-10 09:45",
    historyCount: 2,
    history: [
      { id: "history-4", campaign: "Launch Week", status: "delivered", channel: "web", timestamp: "2026-06-16 08:30" },
      { id: "history-5", campaign: "Weekend Sale", status: "sent", channel: "web", timestamp: "2026-06-15 11:10" },
    ],
  },
  {
    id: "subscriber-3",
    siteId: "site-2",
    endpoint: "https://fcm.googleapis.com/fcm/send/epe-3",
    browser: "Firefox",
    deviceType: "desktop",
    country: "Unknown",
    language: "en",
    status: "inactive",
    lastSeenAt: "2026-06-05 12:00",
    createdAt: "2026-05-30 16:18",
    historyCount: 1,
    history: [{ id: "history-6", campaign: "Weekly Roundup", status: "failed", channel: "web", timestamp: "2026-06-02 09:30" }],
  },
];

interface ApiSubscriberRecord {
  id: string;
  siteId: string;
  subscriptionEndpoint: string;
  browser: string;
  deviceType: string;
  country: string;
  language: string;
  status: SubscriberSummary["status"];
  lastSeenAt: string | null;
  createdAt: string;
}

function toSummary(record: SubscriberDetail): SubscriberSummary {
  return {
    id: record.id,
    siteId: record.siteId,
    endpoint: record.endpoint,
    browser: record.browser,
    deviceType: record.deviceType,
    country: record.country,
    language: record.language,
    status: record.status,
    lastSeenAt: record.lastSeenAt,
    createdAt: record.createdAt,
    historyCount: record.history.length,
  };
}

function toApiSummary(record: ApiSubscriberRecord): SubscriberSummary {
  return {
    id: record.id,
    siteId: record.siteId,
    endpoint: record.subscriptionEndpoint,
    browser: record.browser,
    deviceType: record.deviceType,
    country: record.country,
    language: record.language,
    status: record.status,
    lastSeenAt: record.lastSeenAt,
    createdAt: record.createdAt,
    historyCount: 0,
  };
}

export type SubscriberSortField = "createdAt" | "lastSeenAt" | "country" | "browser" | "deviceType" | "status";

export interface SubscriberListFilters {
  status?: SubscriberSummary["status"] | undefined;
  siteId?: string | undefined;
  deviceType?: string | undefined;
  sortBy?: SubscriberSortField | undefined;
  sortDir?: "asc" | "desc" | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

function buildSubscribersQuery(filters: SubscriberListFilters = {}): string {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  if (filters.siteId) search.set("siteId", filters.siteId);
  if (filters.deviceType) search.set("deviceType", filters.deviceType);
  if (filters.sortBy) search.set("sortBy", filters.sortBy);
  if (filters.sortDir) search.set("sortDir", filters.sortDir);
  search.set("limit", String(filters.limit ?? 50));
  search.set("offset", String(filters.offset ?? 0));
  return search.toString();
}

export async function getSubscriberList(filters: SubscriberListFilters = {}): Promise<SubscriberListPayload> {
  const response = await apiJson<SubscriberApiResponse<{ items: ApiSubscriberRecord[]; total: number }>>(
    `/subscribers?${buildSubscribersQuery(filters)}`,
  );
  if (!response?.data?.items) {
    const fallbackItems = fallbackSubscribers
      .map((subscriber) => toSummary(subscriber))
      .filter((subscriber) => !filters.status || subscriber.status === filters.status)
      .filter((subscriber) => !filters.siteId || subscriber.siteId === filters.siteId)
      .filter((subscriber) => !filters.deviceType || subscriber.deviceType === filters.deviceType);
    return { items: fallbackItems, total: fallbackItems.length };
  }

  const items = response.data.items.map((record) => toApiSummary(record));
  return { items, total: response.data.total };
}

export type SubscriberStatusCounts = Record<SubscriberSummary["status"] | "total", number>;

export async function getSubscriberStatusCounts(siteId?: string): Promise<SubscriberStatusCounts> {
  const statuses: SubscriberSummary["status"][] = ["active", "inactive", "unsubscribed", "expired"];
  const [total, ...counts] = await Promise.all([
    getSubscriberList({ siteId, limit: 1 }),
    ...statuses.map((status) => getSubscriberList({ siteId, status, limit: 1 })),
  ]);

  const result: SubscriberStatusCounts = { total: total.total, active: 0, inactive: 0, unsubscribed: 0, expired: 0 };
  statuses.forEach((status, index) => {
    result[status] = counts[index]?.total ?? 0;
  });
  return result;
}

export async function getSubscriber(id: string): Promise<SubscriberDetail | null> {
  const response = await apiJson<SubscriberApiResponse<ApiSubscriberRecord>>(`/subscribers/${id}`);
  if (response?.data) {
    return { ...toApiSummary(response.data), history: [] };
  }

  return fallbackSubscribers.find((subscriber) => subscriber.id === id) ?? null;
}

export function getFallbackSubscriberList(): SubscriberListPayload {
  const items = fallbackSubscribers.map((subscriber) => toSummary(subscriber));
  return {
    items,
    total: items.length,
  };
}

export function getFallbackSubscriber(id: string): SubscriberDetail | null {
  return fallbackSubscribers.find((subscriber) => subscriber.id === id) ?? null;
}
