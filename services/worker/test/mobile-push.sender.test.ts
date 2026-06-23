import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { FcmMobilePushSender, MobilePushSendError } from "../src/mobile-push.sender";
import type { MobilePushCredentialsRecord } from "../src/mobile-push.types";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const credentials: MobilePushCredentialsRecord = {
  id: "cred-1",
  siteId: "site-1",
  apnsKeyId: null,
  apnsTeamId: null,
  apnsBundleId: null,
  apnsPrivateKey: null,
  fcmProjectId: "project-id",
  fcmClientEmail: "service@example.com",
  fcmPrivateKey: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const notification = { title: "New article", body: "Read the update", url: "https://example.com", icon: null, image: null };

test("FCM sender throws MobilePushSendError with the real status code on an unregistered token", async (t) => {
  const originalFetch = global.fetch;
  let call = 0;
  t.mock.method(global, "fetch", async () => {
    call += 1;
    if (call === 1) {
      return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { status: "UNREGISTERED", message: "Requested entity was not found." } }), {
      status: 404,
    });
  });

  const sender = new FcmMobilePushSender();

  await assert.rejects(
    () => sender.send(credentials, { deviceToken: "token-1", platform: "android" }, notification),
    (error: unknown) => {
      assert.ok(error instanceof MobilePushSendError);
      assert.equal(error.statusCode, 404);
      assert.match(error.message, /UNREGISTERED/);
      return true;
    },
  );

  global.fetch = originalFetch;
});

test("FCM sender returns the provider message id on success", async (t) => {
  const originalFetch = global.fetch;
  let call = 0;
  t.mock.method(global, "fetch", async () => {
    call += 1;
    if (call === 1) {
      return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    }
    return new Response(JSON.stringify({ name: "projects/x/messages/abc123" }), { status: 200 });
  });

  const sender = new FcmMobilePushSender();
  const result = await sender.send(credentials, { deviceToken: "token-1", platform: "android" }, notification);

  assert.equal(result.providerMessageId, "projects/x/messages/abc123");

  global.fetch = originalFetch;
});
