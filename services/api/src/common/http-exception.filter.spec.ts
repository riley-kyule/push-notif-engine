import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";

import { HttpExceptionFilter } from "./http-exception.filter";

function createHost() {
  const calls: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const response = {
    setHeader(name: string, value: string) {
      calls.headers[name] = value;
    },
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
    switchToHttp: () => ({
      getRequest: () => ({ method: "POST", originalUrl: "/api/test" }),
      getResponse: () => response,
    }),
  };
  return { host: host as never, calls };
}

function getErrorBody(body: unknown) {
  return (body as {
    success: false;
    error: { message: string; statusCode: number; code: string; retryable: boolean; errorId: string; details?: string[] };
  }).error;
}

test("HttpExceptionFilter exposes every class-validator message as structured details", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();

  filter.catch(new BadRequestException(["name is required", "url must be a URL"]), host);

  const error = getErrorBody(calls.body);
  assert.equal(calls.status, 400);
  assert.equal(error.message, "name is required url must be a URL");
  assert.deepEqual(error.details, ["name is required", "url must be a URL"]);
  assert.equal(error.code, "BAD_REQUEST");
  assert.equal(error.retryable, false);
  assert.match(error.errorId, /^[0-9a-f-]{36}$/);
  assert.equal(calls.headers["X-Error-Id"], error.errorId);
});

test("HttpExceptionFilter passes through a NotFoundException's message", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();

  filter.catch(new NotFoundException("Site not found"), host);

  const error = getErrorBody(calls.body);
  assert.equal(calls.status, 404);
  assert.equal(error.message, "Site not found");
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.retryable, false);
});

test("HttpExceptionFilter explains unique conflicts without leaking database details", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();
  const databaseError = Object.assign(new Error("duplicate key violates uq_secret_constraint"), { code: "23505" });

  filter.catch(databaseError, host);

  const error = getErrorBody(calls.body);
  assert.equal(calls.status, 409);
  assert.equal(error.code, "RESOURCE_ALREADY_EXISTS");
  assert.match(error.message, /same unique value/);
  assert.doesNotMatch(error.message, /uq_secret_constraint/);
  assert.equal(error.retryable, false);
});

test("HttpExceptionFilter identifies an outdated database schema and supplies a support reference", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();
  const databaseError = Object.assign(new Error("relation secret_table does not exist"), { code: "42P01" });

  filter.catch(databaseError, host);

  const error = getErrorBody(calls.body);
  assert.equal(calls.status, 503);
  assert.equal(error.code, "DATABASE_SCHEMA_OUTDATED");
  assert.match(error.message, /pending migrations/);
  assert.match(error.message, new RegExp(error.errorId));
  assert.doesNotMatch(error.message, /secret_table/);
  assert.equal(error.retryable, true);
});

test("HttpExceptionFilter replaces Nest's generic 500 text with retry and support guidance", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();

  filter.catch(new InternalServerErrorException(), host);

  const error = getErrorBody(calls.body);
  assert.equal(calls.status, 500);
  assert.equal(error.code, "INTERNAL_ERROR");
  assert.match(error.message, /Retry once/);
  assert.match(error.message, new RegExp(error.errorId));
  assert.doesNotMatch(error.message, /^Internal server error$/i);
});

test("HttpExceptionFilter makes unknown failures actionable without exposing internal details", () => {
  const filter = new HttpExceptionFilter();
  const { host, calls } = createHost();

  filter.catch(new Error("private database password and SQL text"), host);

  const error = getErrorBody(calls.body);
  assert.equal(calls.status, 500);
  assert.equal(error.code, "INTERNAL_ERROR");
  assert.match(error.message, /contact support/);
  assert.match(error.message, new RegExp(error.errorId));
  assert.doesNotMatch(error.message, /password|SQL/);
  assert.equal(error.retryable, true);
});
