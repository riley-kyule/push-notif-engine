import assert from "node:assert/strict";
import test from "node:test";

import { createSuccessEnvelope } from "../src/index.js";

test("createSuccessEnvelope wraps data", () => {
  const envelope = createSuccessEnvelope({ service: "api" });

  assert.equal(envelope.success, true);
  assert.deepEqual(envelope.data, { service: "api" });
});
