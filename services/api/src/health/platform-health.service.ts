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

    return {
      status: computeOverallStatus(score),
      score,
      checkedAt,
      components,
      queueDepth,
      workerHeartbeats,
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
      const entries: PlatformWorkerHeartbeat[] = [];

      for (const [key, value] of Object.entries(heartbeats)) {
        const parsed = safeParseHeartbeat(value);
        if (!parsed) {
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
        });
      }

      return entries;
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
