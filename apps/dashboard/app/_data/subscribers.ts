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
  lastSeenAt: string;
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

const fallbackSubscribers: SubscriberDetail[] = [
  {
    id: "subscriber-1",
    siteId: "site-1",
    endpoint: "https://fcm.googleapis.com/fcm/send/epe-1",
    browser: "Chrome",
    deviceType: "mobile",
    country: "South Africa",
    language: "en",
    status: "active",
    lastSeenAt: "2026-06-16 08:40",
    createdAt: "2026-06-12 14:20",
    historyCount: 3,
    history: [
      { id: "history-1", campaign: "Launch Week", status: "delivered", channel: "web", timestamp: "2026-06-16 08:30" },
      { id: "history-2", campaign: "Safari Sale", status: "clicked", channel: "web", timestamp: "2026-06-15 11:10" },
      { id: "history-3", campaign: "Weekly Roundup", status: "sent", channel: "web", timestamp: "2026-06-14 09:00" },
    ],
  },
  {
    id: "subscriber-2",
    siteId: "site-1",
    endpoint: "https://updates.push.apple.com/3/device/epe-2",
    browser: "Safari",
    deviceType: "desktop",
    country: "Kenya",
    language: "en",
    status: "active",
    lastSeenAt: "2026-06-15 15:05",
    createdAt: "2026-06-10 09:45",
    historyCount: 2,
    history: [
      { id: "history-4", campaign: "Launch Week", status: "delivered", channel: "web", timestamp: "2026-06-16 08:30" },
      { id: "history-5", campaign: "Safari Sale", status: "sent", channel: "web", timestamp: "2026-06-15 11:10" },
    ],
  },
  {
    id: "subscriber-3",
    siteId: "site-2",
    endpoint: "https://fcm.googleapis.com/fcm/send/epe-3",
    browser: "Firefox",
    deviceType: "desktop",
    country: "Nigeria",
    language: "en",
    status: "inactive",
    lastSeenAt: "2026-06-05 12:00",
    createdAt: "2026-05-30 16:18",
    historyCount: 1,
    history: [{ id: "history-6", campaign: "Weekly Roundup", status: "failed", channel: "web", timestamp: "2026-06-02 09:30" }],
  },
];

function getApiBaseUrl(): string {
  return process.env.DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
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

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getSubscriberList(): Promise<SubscriberListPayload> {
  const response = await fetchJson<SubscriberApiResponse<{ items: Array<SubscriberSummary> }>>("/dashboard/subscribers");
  const items = response?.data.items ?? fallbackSubscribers.map((subscriber) => toSummary(subscriber));

  return {
    items,
    total: items.length,
  };
}

export async function getSubscriber(id: string): Promise<SubscriberDetail | null> {
  const response = await fetchJson<SubscriberApiResponse<SubscriberDetail>>(`/dashboard/subscribers/${id}`);
  if (response?.data) {
    return response.data;
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
