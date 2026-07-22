import { lookup } from "node:dns/promises";
import tls from "node:tls";

const FCM_HOSTNAME = "fcm.googleapis.com";
const FCM_PORT = 443;
const DEFAULT_TIMEOUT_MS = 5_000;

export interface BrowserPushEgressHealth {
  status: "healthy" | "unhealthy";
  checkedAt: string;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
}

async function probeBrowserPushEgress(): Promise<void> {
  // Production currently has IPv4 egress. Pin the probe to IPv4 so a host
  // publishing AAAA records does not produce a false outage on an otherwise
  // healthy IPv4-only Docker bridge.
  const resolved = await lookup(FCM_HOSTNAME, { family: 4 });

  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({
      host: resolved.address,
      port: FCM_PORT,
      servername: FCM_HOSTNAME,
      timeout: DEFAULT_TIMEOUT_MS,
    });

    const cleanup = (): void => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.once("secureConnect", () => {
      cleanup();
      resolve();
    });
    socket.once("timeout", () => {
      cleanup();
      reject(Object.assign(new Error(`Timed out connecting to ${FCM_HOSTNAME}:${FCM_PORT}`), { code: "ETIMEDOUT" }));
    });
    socket.once("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}

function errorDetails(error: unknown): { code: string | null; message: string } {
  if (!(error instanceof Error)) {
    return { code: null, message: "Unknown browser-push egress failure" };
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : null;
  return { code, message: error.message };
}

export async function checkBrowserPushEgress(
  probe: () => Promise<void> = probeBrowserPushEgress,
): Promise<BrowserPushEgressHealth> {
  const checkedAt = new Date().toISOString();
  const startedAt = process.hrtime.bigint();

  try {
    await probe();
    return {
      status: "healthy",
      checkedAt,
      latencyMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000),
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    const details = errorDetails(error);
    return {
      status: "unhealthy",
      checkedAt,
      latencyMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000),
      errorCode: details.code,
      errorMessage: details.message,
    };
  }
}
