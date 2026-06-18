import assert from "node:assert/strict";
import test from "node:test";

import { computeNextOccurrence } from "./campaign-recurrence.util";

test("computeNextOccurrence advances daily recurrence by the interval", () => {
  const next = computeNextOccurrence(new Date("2026-07-02T10:00:00.000Z"), "daily", 1);
  assert.equal(next.toISOString(), "2026-07-03T10:00:00.000Z");
});

test("computeNextOccurrence advances weekly recurrence by interval weeks", () => {
  const next = computeNextOccurrence(new Date("2026-07-02T10:00:00.000Z"), "weekly", 2);
  assert.equal(next.toISOString(), "2026-07-16T10:00:00.000Z");
});

test("computeNextOccurrence advances monthly recurrence by interval months", () => {
  const next = computeNextOccurrence(new Date("2026-06-02T10:00:00.000Z"), "monthly", 1);
  assert.equal(next.toISOString(), "2026-07-02T10:00:00.000Z");
});

test("computeNextOccurrence treats a non-positive interval as 1", () => {
  const next = computeNextOccurrence(new Date("2026-07-02T10:00:00.000Z"), "daily", 0);
  assert.equal(next.toISOString(), "2026-07-03T10:00:00.000Z");
});
