import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ListAutomationsQueryDto } from "./list-automations-query.dto";

// Query params always arrive as strings off the URL (e.g. "?limit=25") --
// this replicates what the global ValidationPipe actually does (transform,
// then validate) rather than constructing the DTO directly with real
// numbers, which would never have caught the missing @Type(() => Number)
// that broke every real call to GET /automations in production.
test("ListAutomationsQueryDto accepts string query params for limit/offset, same as every other list endpoint", async () => {
  const dto = plainToInstance(ListAutomationsQueryDto, { limit: "25", offset: "0" });
  const errors = await validate(dto);

  assert.deepEqual(errors, []);
  assert.equal(dto.limit, 25);
  assert.equal(typeof dto.limit, "number");
  assert.equal(dto.offset, 0);
  assert.equal(typeof dto.offset, "number");
});

test("ListAutomationsQueryDto still rejects an out-of-range limit", async () => {
  const dto = plainToInstance(ListAutomationsQueryDto, { limit: "500" });
  const errors = await validate(dto);

  assert.ok(errors.some((error) => error.property === "limit"));
});
