import assert from "node:assert/strict";
import test from "node:test";

import { AdaptiveConcurrencyController, mapWithConcurrency } from "../src/concurrency.util";

test("mapWithConcurrency preserves result order regardless of completion order", async () => {
  const delays = [30, 10, 20, 5, 25];
  const results = await mapWithConcurrency(delays, 3, async (delay, index) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return index;
  });

  assert.deepEqual(results, [0, 1, 2, 3, 4]);
});

test("mapWithConcurrency never exceeds the configured limit", async () => {
  let inFlight = 0;
  let maxInFlight = 0;

  await mapWithConcurrency(Array.from({ length: 30 }, (_, i) => i), 4, async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
  });

  assert.ok(maxInFlight <= 4);
  assert.ok(maxInFlight > 1);
});

test("mapWithConcurrency handles an empty input array", async () => {
  const results = await mapWithConcurrency([], 5, async () => "unreachable");
  assert.deepEqual(results, []);
});

test("mapWithConcurrency clamps concurrency below 1 to 1", async () => {
  const order: number[] = [];
  await mapWithConcurrency([1, 2, 3], 0, async (item) => {
    order.push(item);
  });

  assert.deepEqual(order, [1, 2, 3]);
});

test("adaptive concurrency backs off on provider pressure and recovers gradually", () => {
  const controller = new AdaptiveConcurrencyController(100, 10);
  for (let index = 0; index < 100; index += 1) controller.observe(index < 10);
  assert.equal(controller.advanceWindow(), 50);
  for (let index = 0; index < 100; index += 1) controller.observe(false);
  assert.equal(controller.advanceWindow(), 60);
});
