import { checkBrowserPushEgress } from "./egress-health";

async function main(): Promise<void> {
  const health = await checkBrowserPushEgress();
  if (health.status === "healthy") {
    // eslint-disable-next-line no-console
    console.log(`Browser push egress healthy (${health.latencyMs}ms)`);
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`${health.errorCode ?? "EGRESS_UNHEALTHY"}: ${health.errorMessage ?? "Browser push egress unavailable"}`);
  process.exitCode = 1;
}

void main();
