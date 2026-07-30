import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDisplayDateTimeToMinute,
  formatDisplayDateTimeToMinuteInZone,
} from "../app/_components/format-date";

test("campaign send time is displayed to the exact minute in UTC+3", () => {
  assert.equal(
    formatDisplayDateTimeToMinute("2026-07-30T10:05:49.000Z"),
    "30/07/2026-13:05",
  );
});

test("campaign platform time uses the campaign site's IANA timezone", () => {
  assert.equal(
    formatDisplayDateTimeToMinuteInZone("2026-07-30T10:05:49.000Z", "Africa/Accra"),
    "30/07/2026-10:05",
  );
});

test("campaign send time renders an em dash when no timestamp exists", () => {
  assert.equal(formatDisplayDateTimeToMinute(null), "—");
});
