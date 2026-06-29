import { Inject, Injectable } from "@nestjs/common";
import IORedis from "ioredis";
import { Pool } from "pg";

import { AnalyticsService } from "../analytics/analytics.service";
import { CAMPAIGN_MEDIA_STORAGE } from "../campaign-media/campaign-media.constants";
import type { CampaignMediaStoragePort } from "../campaign-media/campaign-media-storage.port";
import { DATABASE_POOL } from "../database/database.constants";
import { loadRedisConfig } from "../queue/redis.config";
import { BROWSER_PUSH_QUEUE_NAME } from "../browser-push/browser-push.constants";
import { MOBILE_PUSH_QUEUE_NAME } from "../mobile-push/mobile-push.constants";
import { PLATFORM_HEALTH_REDIS } from "./platform-health.constants";
import type {
  PlatformHealthComponent,
  PlatformHealthStatus,
  PlatformHealthSummary,
  PlatformQueueDepth,
  PlatformSiteHealth,
  PlatformWorkerHeartbeat,
  PlatformHealthAlert,
} from "./platform-health.types";

const PLATFORM_HEARTBEAT_HASH = "epe:worker-heartbeats";
const HEARTBEAT_STALE_AFTER_MS = 2 * 60 * 1000;

function computeOverallStatus(score: number): PlatformHealthStatus {
  if (score >= 100) {
    return "healthy";
  }

  if (score <= 0) {
    return "unhealthy";
  }

  return "degraded";
}

function scoreComponent(status: boolean, weight: number): number {
  return status ? weight : 0;
}

@Injectable()
export class PlatformHealthService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(CAMPAIGN_MEDIA_STORAGE) private readonly campaignMediaStorage: CampaignMediaStoragePort,
    @Inject(PLATFORM_HEALTH_REDIS) private readonly redis: IORedis,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getPlatformHealth(): Promise<PlatformHealthSummary> {
    const checkedAt = new Date().toISOString();

    const [databaseHealthy, storageHealthy, queueHealthy] = await Promise.all([
      this.checkDatabase(),
      this.campaignMediaStorage.ping(),
      this.checkQueueBroker(),
    ]);
    const [queueDepth, workerHeartbeats, siteHealth] = await Promise.all([
      this.getQueueDepth(),
      this.getWorkerHeartbeats(),
      this.getSiteHealth(),
    ]);

    const components: PlatformHealthComponent[] = [
      {
        key: "database",
        label: "Database",
        status: databaseHealthy ? "healthy" : "unhealthy",
        detail: databaseHealthy ? "PostgreSQL responded to a live query." : "PostgreSQL query failed.",
        weight: 40,
        score: scoreComponent(databaseHealthy, 40),
      },
      {
        key: "queue",
        label: "Queue broker",
        status: queueHealthy ? "healthy" : "unhealthy",
        detail: queueHealthy ? "Redis is responding for BullMQ workers and rate limiting." : "Redis is unreachable.",
        weight: 30,
        score: scoreComponent(queueHealthy, 30),
      },
      {
        key: "storage",
        label: "Media storage",
        status: storageHealthy ? "healthy" : "unhealthy",
        detail: storageHealthy ? "Campaign media bucket is reachable." : "Campaign media bucket is unreachable.",
        weight: 30,
        score: scoreComponent(storageHealthy, 30),
      },
    ];

    const score = components.reduce((total, component) => total + component.score, 0);
    const alerts = this.buildAlerts(components, queueDepth, workerHeartbeats, siteHealth);

    return {
      status: computeOverallStatus(score),
      score,
      checkedAt,
      components,
      queueDepth,
      workerHeartbeats,
      alerts,
      siteHealth,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  private async checkQueueBroker(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }

  private async getQueueDepth(): Promise<PlatformQueueDepth[]> {
    try {
      const [browserCounts, mobileCounts] = await Promise.all([
        this.getQueueCounts(BROWSER_PUSH_QUEUE_NAME),
        this.getQueueCounts(MOBILE_PUSH_QUEUE_NAME),
      ]);

      return [
        {
          key: "browser-push",
          label: "Browser push",
          waiting: browserCounts.waiting,
          active: browserCounts.active,
          delayed: browserCounts.delayed,
          failed: browserCounts.failed,
          completed: browserCounts.completed,
        },
        {
          key: "mobile-push",
          label: "Mobile push",
          waiting: mobileCounts.waiting,
          active: mobileCounts.active,
          delayed: mobileCounts.delayed,
          failed: mobileCounts.failed,
          completed: mobileCounts.completed,
        },
      ];
    } catch {
      return [
        { key: "browser-push", label: "Browser push", waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
        { key: "mobile-push", label: "Mobile push", waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
      ];
    }
  }

  private async getQueueCounts(queueName: string): Promise<PlatformQueueDepth> {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      this.redis.llen(`bull:${queueName}:wait`),
      this.redis.llen(`bull:${queueName}:active`),
      this.redis.zcard(`bull:${queueName}:delayed`),
      this.redis.zcard(`bull:${queueName}:failed`),
      this.redis.zcard(`bull:${queueName}:completed`),
    ]);

    return {
      key: queueName === BROWSER_PUSH_QUEUE_NAME ? "browser-push" : "mobile-push",
      label: queueName === BROWSER_PUSH_QUEUE_NAME ? "Browser push" : "Mobile push",
      waiting,
      active,
      delayed,
      failed,
      completed,
    };
  }

  private async getWorkerHeartbeats(): Promise<PlatformWorkerHeartbeat[]> {
    try {
      const heartbeats = await this.redis.hgetall(PLATFORM_HEARTBEAT_HASH);
      const now = Date.now();
      const entries: Array<PlatformWorkerHeartbeat & { lastSeenMs: number }> = [];
      const malformedFields: string[] = [];

      for (const [key, value] of Object.entries(heartbeats)) {
        const parsed = safeParseHeartbeat(value);
        if (!parsed) {
          malformedFields.push(key);
          continue;
        }

        const lastSeenMs = Date.parse(parsed.lastSeenAt);
        const age = Number.isFinite(lastSeenMs) ? now - lastSeenMs : Number.POSITIVE_INFINITY;
        const status = age <= HEARTBEAT_STALE_AFTER_MS ? "healthy" : age <= HEARTBEAT_STALE_AFTER_MS * 3 ? "stale" : "offline";

        entries.push({
          key,
          label: parsed.label,
          lastSeenAt: parsed.lastSeenAt,
          uptimeMs: parsed.uptimeMs,
          redisLatencyMs: parsed.redisLatencyMs,
          status,
          lastSeenMs: Number.isFinite(lastSeenMs) ? lastSeenMs : 0,
        });
      }

      // This deployment runs one worker process; every restart (a deploy, a
      // crash, today's manual restarts) writes a heartbeat under a new PID
      // without reliably clearing the old one if the process got killed
      // before its shutdown hook ran. Those dead PIDs never expire on their
      // own, so without this they'd accumulate as permanent "offline"
      // entries -- which is exactly what produced "4 workers offline" today.
      // Once a fresher (healthy/stale) entry exists, every offline entry is
      // a confirmed ghost from a past process and gets pruned. If every
      // entry is offline (the worker is genuinely down), keep only the most
      // recent one so the real outage still surfaces as a single alert
      // instead of N stale ghosts.
      const offlineFields = entries.filter((entry) => entry.status === "offline").map((entry) => entry.key);
      const hasLiveEntry = entries.some((entry) => entry.status !== "offline");
      const fieldsToPrune = [...malformedFields];
      let visible = entries;

      if (offlineFields.length > 0) {
        if (hasLiveEntry) {
          fieldsToPrune.push(...offlineFields);
          visible = entries.filter((entry) => entry.status !== "offline");
        } else {
          const mostRecent = [...entries].sort((left, right) => right.lastSeenMs - left.lastSeenMs)[0];
          fieldsToPrune.push(...offlineFields.filter((key) => key !== mostRecent?.key));
          visible = mostRecent ? [mostRecent] : [];
        }
      }

      if (fieldsToPrune.length > 0) {
        void this.redis.hdel(PLATFORM_HEARTBEAT_HASH, ...fieldsToPrune).catch(() => {});
      }

      return visible.map(({ lastSeenMs, ...entry }) => entry);
    } catch {
      return [];
    }
  }

  private async getSiteHealth(): Promise<{ highestDelivery: PlatformSiteHealth[]; lowestDelivery: PlatformSiteHealth[] }> {
    try {
      const analytics = await this.analyticsService.getSitePerformance(30);
      const ranked = analytics
        .filter((site) => site.siteName.toLowerCase() !== "all sites")
        .map((site) => ({
          siteId: site.siteId,
          siteName: site.siteName,
          deliveryRate: site.deliveryRate,
          clickThroughRate: site.clickThroughRate,
          totalDelivered: site.totalDelivered,
          totalFailed: site.totalFailed,
        }))
        .sort((left, right) => right.deliveryRate - left.deliveryRate);

      return {
        highestDelivery: ranked.slice(0, 3),
        lowestDelivery: [...ranked].reverse().slice(0, 3),
      };
    } catch {
      return {
        highestDelivery: [],
        lowestDelivery: [],
      };
    }
  }

  private buildAlerts(
    components: PlatformHealthComponent[],
    queueDepth: PlatformQueueDepth[],
    workerHeartbeats: PlatformWorkerHeartbeat[],
    siteHealth: { highestDelivery: PlatformSiteHealth[]; lowestDelivery: PlatformSiteHealth[] },
  ): PlatformHealthAlert[] {
    const alerts: PlatformHealthAlert[] = [];

    for (const component of components) {
      if (component.status === "healthy") {
        continue;
      }

      alerts.push({
        key: `component:${component.key}`,
        severity: component.key === "storage" ? "warning" : "critical",
        title: `${component.label} is degraded`,
        detail: component.detail,
      });
    }

    const totalFailedJobs = queueDepth.reduce((total, queue) => total + queue.failed, 0);
    const totalWaitingJobs = queueDepth.reduce((total, queue) => total + queue.waiting + queue.active + queue.delayed, 0);
    if (totalFailedJobs > 0) {
      alerts.push({
        key: "queue:failed-jobs",
        severity: "warning",
        title: "Queue failures detected",
        detail: `${totalFailedJobs} queued jobs have failed and should be reviewed.`,
      });
    } else if (totalWaitingJobs > 500) {
      alerts.push({
        key: "queue:backlog",
        severity: "warning",
        title: "Queue backlog is growing",
        detail: `${totalWaitingJobs} jobs are waiting, active, or delayed across delivery queues.`,
      });
    }

    const staleWorkers = workerHeartbeats.filter((worker) => worker.status !== "healthy");
    if (staleWorkers.length > 0) {
      alerts.push({
        key: "workers:stale",
        severity: staleWorkers.some((worker) => worker.status === "offline") ? "critical" : "warning",
        title: "Worker heartbeats need attention",
        detail: `${staleWorkers.length} worker(s) are stale or offline.`,
      });
    }

    const weakestSite = siteHealth.lowestDelivery[0];
    if (weakestSite && weakestSite.deliveryRate < 80) {
      alerts.push({
        key: `site:${weakestSite.siteId}`,
        severity: "info",
        title: "Lowest delivery site is under 80%",
        detail: `${weakestSite.siteName} is at ${weakestSite.deliveryRate.toFixed(1)}% delivery rate.`,
      });
    }

    return alerts;
  }
}

export function createPlatformHealthRedisClient(): IORedis {
  const config = loadRedisConfig();
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  }) as IORedis;
}

function safeParseHeartbeat(value: string): { label: string; lastSeenAt: string; uptimeMs: number; redisLatencyMs: number } | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "label" in parsed &&
      "lastSeenAt" in parsed &&
      "uptimeMs" in parsed &&
      "redisLatencyMs" in parsed &&
      typeof (parsed as { label: unknown }).label === "string" &&
      typeof (parsed as { lastSeenAt: unknown }).lastSeenAt === "string" &&
      typeof (parsed as { uptimeMs: unknown }).uptimeMs === "number" &&
      typeof (parsed as { redisLatencyMs: unknown }).redisLatencyMs === "number"
    ) {
      return {
        label: (parsed as { label: string }).label,
        lastSeenAt: (parsed as { lastSeenAt: string }).lastSeenAt,
        uptimeMs: (parsed as { uptimeMs: number }).uptimeMs,
        redisLatencyMs: (parsed as { redisLatencyMs: number }).redisLatencyMs,
      };
    }
    return null;
  } catch {
    return null;
  }
}
