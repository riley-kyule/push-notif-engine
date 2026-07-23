import { performance } from "node:perf_hooks";

import { AdaptiveConcurrencyController, mapWithConcurrency } from "../dist/src/concurrency.util.js";

function readInteger(flag, positionalValue, fallback, minimum) {
  const flagArgument = process.argv.slice(2).find((argument) => argument.startsWith(`${flag}=`));
  const raw = flagArgument?.slice(flag.length + 1) ?? positionalValue ?? String(fallback);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${flag} must be an integer greater than or equal to ${minimum}`);
  }
  return parsed;
}

const positional = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const recipients = readInteger("--subscribers", positional[0], 100_000, 1);
const configuredConcurrency = readInteger("--concurrency", positional[1], 200, 1);
const simulatedLatencyMs = readInteger("--latency-ms", positional[2], 10, 0);
const batchSize = 5_000;
const controller = new AdaptiveConcurrencyController(configuredConcurrency);
let maximumInFlight = 0;
let inFlight = 0;
const startedAt = performance.now();

for (let offset = 0; offset < recipients; offset += batchSize) {
  const size = Math.min(batchSize, recipients - offset);
  await mapWithConcurrency(Array.from({ length: size }), controller.current, async () => {
    inFlight += 1;
    maximumInFlight = Math.max(maximumInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
    inFlight -= 1;
    controller.observe(false);
  });
  controller.advanceWindow();
}

const elapsedSeconds = (performance.now() - startedAt) / 1000;
console.log(JSON.stringify({
  recipients,
  elapsedSeconds: Math.round(elapsedSeconds * 100) / 100,
  deliveriesPerSecond: Math.round(recipients / elapsedSeconds),
  configuredConcurrency,
  maximumInFlight,
  simulatedLatencyMs,
}, null, 2));
