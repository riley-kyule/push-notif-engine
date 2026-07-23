import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";

import { decryptVapidPrivateKey } from "../src/vapid-key-encryption.util";

test("worker decrypts the API VAPID envelope and accepts legacy plaintext", () => {
  const previous = process.env.VAPID_KEY_ENCRYPTION_KEY;
  const key = Buffer.alloc(32, 9);
  process.env.VAPID_KEY_ENCRYPTION_KEY = key.toString("base64");
  try {
    const iv = Buffer.alloc(12, 4);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update("secret", "utf8"), cipher.final()]);
    const payload = `epe:vapid:v1:${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
    assert.equal(decryptVapidPrivateKey(payload), "secret");
    assert.equal(decryptVapidPrivateKey("legacy"), "legacy");
  } finally {
    if (previous === undefined) delete process.env.VAPID_KEY_ENCRYPTION_KEY;
    else process.env.VAPID_KEY_ENCRYPTION_KEY = previous;
  }
});
