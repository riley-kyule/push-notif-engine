import { lookup } from "node:dns/promises";
import tls from "node:tls";

const PROVIDERS = [
  { provider: "fcm", hostname: "fcm.googleapis.com" },
  { provider: "google-oauth", hostname: "oauth2.googleapis.com" },
  { provider: "apns", hostname: "api.push.apple.com" },
] as const;
const DEFAULT_TIMEOUT_MS = 5_000;

export interface ProviderEgressProbe {
  provider: string;
  hostname: string;
  status: "healthy" | "unhealthy";
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface BrowserPushEgressHealth {
  status: "healthy" | "unhealthy";
  checkedAt: string;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  providers?: ProviderEgressProbe[];
}

async function probeHost(hostname: string): Promise<void> {
  // Production currently has IPv4 egress. Pin the probe to IPv4 so a host
  // publishing AAAA records does not produce a false outage on an otherwise
  // healthy IPv4-only Docker bridge.
  const resolved = await lookup(hostname, { family: 4 });

  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({
      host: resolved.address,
      port: 443,
      servername: hostname,
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
      reject(Object.assign(new Error(`Timed out connecting to ${hostname}:443`), { code: "ETIMEDOUT" }));
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
  probe?: () => Promise<void>,
): Promise<BrowserPushEgressHealth> {
  const checkedAt = new Date().toISOString();
  const startedAt = process.hrtime.bigint();

  if (!probe) {
    const providers = await Promise.all(PROVIDERS.map(async ({ provider, hostname }): Promise<ProviderEgressProbe> => {
      const providerStartedAt = process.hrtime.bigint();
      try {
        await probeHost(hostname);
        return { provider, hostname, status: "healthy", latencyMs: Math.round(Number(process.hrtime.bigint() - providerStartedAt) / 1_000_000), errorCode: null, errorMessage: null };
      } catch (error) {
        const details = errorDetails(error);
        return { provider, hostname, status: "unhealthy", latencyMs: Math.round(Number(process.hrtime.bigint() - providerStartedAt) / 1_000_000), errorCode: details.code, errorMessage: details.message };
      }
    }));
    const failed = providers.find((provider) => provider.status === "unhealthy");
    return {
      status: failed ? "unhealthy" : "healthy",
      checkedAt,
      latencyMs: Math.max(...providers.map((provider) => provider.latencyMs)),
      errorCode: failed?.errorCode ?? null,
      errorMessage: failed ? `${failed.provider}: ${failed.errorMessage ?? "unreachable"}` : null,
      providers,
    };
  }

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
