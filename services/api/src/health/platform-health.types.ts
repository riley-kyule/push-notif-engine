export type PlatformHealthStatus = "healthy" | "degraded" | "unhealthy";

export type PlatformHealthComponentStatus = "healthy" | "unhealthy";

export interface PlatformHealthComponent {
  key: "database" | "storage" | "queue";
  label: string;
  status: PlatformHealthComponentStatus;
  detail: string;
  score: number;
  weight: number;
}

export interface PlatformQueueDepth {
  key: "browser-push" | "mobile-push";
  label: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface PlatformWorkerHeartbeat {
  key: string;
  label: string;
  lastSeenAt: string | null;
  uptimeMs: number;
  redisLatencyMs: number;
  status: "healthy" | "stale" | "offline";
}

export interface PlatformSiteHealth {
  siteId: string;
  siteName: string;
  deliveryRate: number;
  clickThroughRate: number;
  totalDelivered: number;
  totalFailed: number;
}

export interface PlatformHealthAlert {
  key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export interface PlatformHealthSummary {
  status: PlatformHealthStatus;
  score: number;
  checkedAt: string;
  components: PlatformHealthComponent[];
  queueDepth: PlatformQueueDepth[];
  workerHeartbeats: PlatformWorkerHeartbeat[];
  alerts: PlatformHealthAlert[];
  siteHealth: {
    highestDelivery: PlatformSiteHealth[];
    lowestDelivery: PlatformSiteHealth[];
  };
}
