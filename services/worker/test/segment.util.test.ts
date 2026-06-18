import assert from "node:assert/strict";
import test from "node:test";

import { buildSegmentFilterClause } from "../src/segment.util";

test("buildSegmentFilterClause returns null clause for an empty rule set", () => {
  const result = buildSegmentFilterClause({ matchMode: "all", rules: [] }, 2);
  assert.equal(result.clause, null);
  assert.deepEqual(result.params, []);
});

test("buildSegmentFilterClause joins multiple rules with AND for matchMode 'all'", () => {
  const result = buildSegmentFilterClause(
    {
      matchMode: "all",
      rules: [
        { field: "country", operator: "is", value: "Kenya" },
        { field: "browser", operator: "isNot", value: "Safari" },
      ],
    },
    2,
  );

  assert.equal(result.clause, "(country = $2 AND browser <> $3)");
  assert.deepEqual(result.params, ["Kenya", "Safari"]);
});

test("buildSegmentFilterClause joins multiple rules with OR for matchMode 'any'", () => {
  const result = buildSegmentFilterClause(
    {
      matchMode: "any",
      rules: [
        { field: "language", operator: "in", value: ["en", "fr"] },
        { field: "deviceType", operator: "is", value: "mobile" },
      ],
    },
    2,
  );

  assert.equal(result.clause, "(language = ANY($2::text[]) OR device_type = $3)");
  assert.deepEqual(result.params, [["en", "fr"], "mobile"]);
});

test("buildSegmentFilterClause handles lastSeenAt withinDays/olderThanDays", () => {
  const within = buildSegmentFilterClause(
    { matchMode: "all", rules: [{ field: "lastSeenAt", operator: "withinDays", value: 7 }] },
    3,
  );
  assert.equal(within.clause, "(last_seen_at >= NOW() - ($3::int * INTERVAL '1 day'))");
  assert.deepEqual(within.params, [7]);

  const older = buildSegmentFilterClause(
    { matchMode: "all", rules: [{ field: "lastSeenAt", operator: "olderThanDays", value: 30 }] },
    3,
  );
  assert.equal(older.clause, "(last_seen_at < NOW() - ($3::int * INTERVAL '1 day'))");
  assert.deepEqual(older.params, [30]);
});
