import assert from "node:assert/strict";
import test from "node:test";

import { decryptVapidPrivateKey, encryptVapidPrivateKey } from "./vapid-key-encryption.util";

test("VAPID private-key encryption round-trips and authenticates ciphertext", () => {
  const previous = process.env.VAPID_KEY_ENCRYPTION_KEY;
  process.env.VAPID_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptVapidPrivateKey("private-key");
    assert.match(encrypted, /^epe:vapid:v1:/);
    assert.notEqual(encrypted, "private-key");
    assert.equal(decryptVapidPrivateKey(encrypted), "private-key");
    assert.equal(decryptVapidPrivateKey("legacy-plaintext"), "legacy-plaintext");
  } finally {
    if (previous === undefined) delete process.env.VAPID_KEY_ENCRYPTION_KEY;
    else process.env.VAPID_KEY_ENCRYPTION_KEY = previous;
  }
});
