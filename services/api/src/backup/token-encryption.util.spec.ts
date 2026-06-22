import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { decryptToken, encryptToken } from "./token-encryption.util";

test("encryptToken/decryptToken round-trips a plaintext token", () => {
  process.env.BACKUP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

  const plaintext = "dropbox-refresh-token-abc123";
  const encrypted = encryptToken(plaintext);

  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptToken(encrypted), plaintext);
});

test("decryptToken fails on a tampered payload", () => {
  process.env.BACKUP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

  const encrypted = encryptToken("some-secret");
  const parts = encrypted.split(".");
  const tampered = [parts[0], parts[1], Buffer.from("tampered-data").toString("base64")].join(".");

  assert.throws(() => decryptToken(tampered));
});

test("encryptToken throws without a configured key", () => {
  delete process.env.BACKUP_TOKEN_ENCRYPTION_KEY;
  assert.throws(() => encryptToken("x"), /BACKUP_TOKEN_ENCRYPTION_KEY/);
});
