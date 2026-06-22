import type IORedis from "ioredis";

export const WORKER_HEARTBEAT_HASH = "epe:worker-heartbeats";

export interface WorkerHeartbeatPayload {
  label: string;
  lastSeenAt: string;
  uptimeMs: number;
  redisLatencyMs: number;
}

export function heartbeatField(pid: number): string {
  return `worker:${pid}`;
}

export async function writeWorkerHeartbeat(redis: IORedis, payload: WorkerHeartbeatPayload, pid = process.pid): Promise<void> {
  await redis.hset(WORKER_HEARTBEAT_HASH, heartbeatField(pid), JSON.stringify(payload));
}

export async function clearWorkerHeartbeat(redis: IORedis, pid = process.pid): Promise<void> {
  await redis.hdel(WORKER_HEARTBEAT_HASH, heartbeatField(pid));
}

export function createHeartbeatPayload(label: string): WorkerHeartbeatPayload {
  return {
    label,
    lastSeenAt: new Date().toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    redisLatencyMs: 0,
  };
}
