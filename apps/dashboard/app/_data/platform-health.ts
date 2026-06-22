import { apiJson } from "../../lib/server-api";

export type PlatformHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface PlatformHealthComponentSummary {
  key: string;
  label: string;
  status: "healthy" | "unhealthy";
  detail: string;
  score: number;
  weight: number;
}

export interface PlatformQueueDepthSummary {
  key: "browser-push" | "mobile-push";
  label: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface PlatformWorkerHeartbeatSummary {
  key: string;
  label: string;
  lastSeenAt: string | null;
  uptimeMs: number;
  redisLatencyMs: number;
  status: "healthy" | "stale" | "offline";
}

export interface PlatformSiteHealthSummary {
  siteId: string;
  siteName: string;
  deliveryRate: number;
  clickThroughRate: number;
  totalDelivered: number;
  totalFailed: number;
}

export interface PlatformHealthAlertSummary {
  key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export interface PlatformHealthSummary {
  source: "live" | "demo" | "unavailable";
  status: PlatformHealthStatus;
  score: number;
  checkedAt: string | null;
  components: PlatformHealthComponentSummary[];
  queueDepth: PlatformQueueDepthSummary[];
  workerHeartbeats: PlatformWorkerHeartbeatSummary[];
  alerts: PlatformHealthAlertSummary[];
  siteHealth: {
    highestDelivery: PlatformSiteHealthSummary[];
    lowestDelivery: PlatformSiteHealthSummary[];
  };
}

export interface PlatformHealthBadge {
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

interface PlatformHealthApiResponse {
  success: true;
  data: {
    status: "healthy" | "degraded" | "unhealthy";
    score: number;
    checkedAt: string;
    components: PlatformHealthComponentSummary[];
    queueDepth: PlatformQueueDepthSummary[];
    workerHeartbeats: PlatformWorkerHeartbeatSummary[];
    alerts: PlatformHealthAlertSummary[];
    siteHealth: {
      highestDelivery: PlatformSiteHealthSummary[];
      lowestDelivery: PlatformSiteHealthSummary[];
    };
  };
}

const fallbackHealth: PlatformHealthSummary = {
  source: "unavailable",
  status: "unknown",
  score: 0,
  checkedAt: null,
  components: [
    {
      key: "database",
      label: "Database",
      status: "unhealthy",
      detail: "Unavailable until the API health endpoint responds.",
      score: 0,
      weight: 40,
    },
    {
      key: "queue",
      label: "Queue broker",
      status: "unhealthy",
      detail: "Unavailable until Redis is reachable.",
      score: 0,
      weight: 30,
    },
    {
      key: "storage",
      label: "Media storage",
      status: "unhealthy",
      detail: "Unavailable until object storage is reachable.",
      score: 0,
      weight: 30,
    },
  ],
  queueDepth: [
    { key: "browser-push", label: "Browser push", waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
    { key: "mobile-push", label: "Mobile push", waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
  ],
  workerHeartbeats: [],
  alerts: [
    {
      key: "demo:queue",
      severity: "info",
      title: "Demo alert stream",
      detail: "This is a demo snapshot with realistic alert data for local development.",
    },
  ],
  siteHealth: {
    highestDelivery: [],
    lowestDelivery: [],
  },
};

const demoHealth: PlatformHealthSummary = {
  source: "demo",
  status: "healthy",
  score: 96,
  checkedAt: new Date().toISOString(),
  components: [
    {
      key: "database",
      label: "Database",
      status: "healthy",
      detail: "PostgreSQL responded to a live query.",
      score: 40,
      weight: 40,
    },
    {
      key: "queue",
      label: "Queue broker",
      status: "healthy",
      detail: "Redis is responding for BullMQ workers and rate limiting.",
      score: 30,
      weight: 30,
    },
    {
      key: "storage",
      label: "Media storage",
      status: "healthy",
      detail: "Campaign media bucket is reachable.",
      score: 26,
      weight: 30,
    },
  ],
  queueDepth: [
    { key: "browser-push", label: "Browser push", waiting: 12, active: 2, delayed: 1, failed: 0, completed: 148 },
    { key: "mobile-push", label: "Mobile push", waiting: 4, active: 1, delayed: 0, failed: 0, completed: 83 },
  ],
  workerHeartbeats: [
    {
      key: "worker:demo-1",
      label: "browser-push-worker-1",
      lastSeenAt: new Date(Date.now() - 18_000).toISOString(),
      uptimeMs: 4_280_000,
      redisLatencyMs: 3,
      status: "healthy",
    },
    {
      key: "worker:demo-2",
      label: "mobile-push-worker-1",
      lastSeenAt: new Date(Date.now() - 33_000).toISOString(),
      uptimeMs: 3_740_000,
      redisLatencyMs: 4,
      status: "healthy",
    },
  ],
  alerts: [
    {
      key: "demo:queue",
      severity: "info",
      title: "Demo alert stream",
      detail: "This is a demo snapshot with realistic alert data for local development.",
    },
  ],
  siteHealth: {
    highestDelivery: [
      { siteId: "site-1", siteName: "Exotic Africa", deliveryRate: 98.4, clickThroughRate: 7.1, totalDelivered: 184_211, totalFailed: 822 },
      { siteId: "site-2", siteName: "Exotic Lifestyle", deliveryRate: 96.8, clickThroughRate: 6.4, totalDelivered: 141_804, totalFailed: 1_034 },
      { siteId: "site-3", siteName: "Exotic News", deliveryRate: 95.2, clickThroughRate: 5.9, totalDelivered: 92_440, totalFailed: 1_208 },
    ],
    lowestDelivery: [
      { siteId: "site-4", siteName: "Exotic Entertainment", deliveryRate: 71.3, clickThroughRate: 3.2, totalDelivered: 74_211, totalFailed: 5_384 },
      { siteId: "site-5", siteName: "Exotic Sports", deliveryRate: 74.8, clickThroughRate: 3.7, totalDelivered: 66_002, totalFailed: 4_901 },
      { siteId: "site-6", siteName: "Exotic Travel", deliveryRate: 79.1, clickThroughRate: 4.1, totalDelivered: 82_550, totalFailed: 3_214 },
    ],
  },
};

export function summarizePlatformHealth(summary?: PlatformHealthSummary | null): PlatformHealthSummary {
  return summary ?? fallbackHealth;
}

export function getPlatformHealthBadge(score: number): PlatformHealthBadge {
  if (score >= 95) {
    return { label: "Healthy", tone: "good" };
  }

  if (score >= 70) {
    return { label: "Watch", tone: "warn" };
  }

  if (score > 0) {
    return { label: "At risk", tone: "bad" };
  }

  return { label: "Unknown", tone: "neutral" };
}

export function getPlatformHealthTone(status: PlatformHealthStatus): "good" | "warn" | "bad" | "neutral" {
  switch (status) {
    case "healthy":
      return "good";
    case "degraded":
      return "warn";
    case "unhealthy":
      return "bad";
    default:
      return "neutral";
  }
}

export async function getPlatformHealthSummary(): Promise<PlatformHealthSummary> {
  try {
    const response = await apiJson<PlatformHealthApiResponse>("/health/platform");
    if (!response?.data) {
      return process.env.NODE_ENV === "production" ? fallbackHealth : demoHealth;
    }

    return {
      source: "live",
      status: response.data.status,
      score: response.data.score,
      checkedAt: response.data.checkedAt,
      components: response.data.components,
      queueDepth: response.data.queueDepth,
      workerHeartbeats: response.data.workerHeartbeats,
      alerts: response.data.alerts,
      siteHealth: response.data.siteHealth,
    };
  } catch {
    return process.env.NODE_ENV === "production" ? fallbackHealth : demoHealth;
  }
}
