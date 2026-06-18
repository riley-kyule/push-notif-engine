import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const swPath = path.resolve(process.cwd(), "..", "..", "apps", "dashboard", "public", "browser-push-sw.js");

test("local browser push service worker exists", () => {
  const file = readFileSync(swPath, "utf8");
  assert.match(file, /showNotification/);
  assert.match(file, /notificationclick/);
  assert.match(file, /skipWaiting/);
  assert.match(file, /browser-push-demo/);
  assert.match(file, /message/);
  assert.match(file, /acknowledgeDelivery/);
  assert.match(file, /deliveryId/);
  assert.match(file, /acknowledgeClick/);
  assert.match(file, /clickUrl/);
});
