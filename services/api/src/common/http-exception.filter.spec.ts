import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import { HttpExceptionFilter } from "./http-exception.filter";

function createHost() {
  const calls: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      calls.status = code;
      return {
        json(body: unknown) {
          calls.body = body;
        },
      };
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  };
  return { host: host as never, calls };
}

test("HttpExceptionFilter joins class-validator's array message into one readable string", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();

  filter.catch(new BadRequestException(["name is required", "url must be a URL"]), host);

  assert.equal(calls.status, 400);
  assert.deepEqual(calls.body, {
    success: false,
    error: { message: "name is required url must be a URL", statusCode: 400 },
  });
});

test("HttpExceptionFilter passes through a NotFoundException's message", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();

  filter.catch(new NotFoundException("Site not found"), host);

  assert.equal(calls.status, 404);
  assert.deepEqual(calls.body, { success: false, error: { message: "Site not found", statusCode: 404 } });
});

test("HttpExceptionFilter hides internal details for unexpected errors behind a generic 500 message", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();

  filter.catch(new Error("relation \"sites\" does not exist"), host);

  assert.equal(calls.status, 500);
  assert.deepEqual(calls.body, {
    success: false,
    error: { message: "Something went wrong on our end. Please try again.", statusCode: 500 },
  });
});
