import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManifestAsset,
  buildRestApiSnippet,
  buildRestApiUsageSnippet,
  buildSdkSnippet,
  buildSubscriptionShortcode,
  buildServiceWorkerAsset,
} from "../app/sites/site-integrations";

const site = {
  id: "site-1",
  name: "Exotic Africa",
  url: "https://exotic-africa.com",
  country: "South Africa",
  language: "en",
  platform: "WordPress" as const,
  status: "active" as const,
  subscribers: 2418400,
  vapidPublicKey: "BExoticKey1",
};

test("site integration artifacts are generated per site", () => {
  const sdkSnippet = buildSdkSnippet(site);
  const subscriptionShortcode = buildSubscriptionShortcode();
  const restApiSnippet = buildRestApiSnippet(site);
  const restApiUsageSnippet = buildRestApiUsageSnippet(site);
  const serviceWorker = buildServiceWorkerAsset(site);
  const manifest = buildManifestAsset(site);

  assert.match(sdkSnippet, /site-1/);
  assert.match(sdkSnippet, /vapidPublicKey/);
  assert.match(sdkSnippet, /push-sw\.js/);
  assert.match(sdkSnippet, /manifest\.json/);
  assert.match(sdkSnippet, /Exotic Africa/);
  assert.equal(subscriptionShortcode, "[epe_subscribe_button]");
  assert.match(restApiSnippet, /rest-api-credentials/);
  assert.match(restApiSnippet, /Authorization: Bearer/);
  assert.match(restApiUsageSnippet, /rest-api\/identity/);
  assert.match(restApiUsageSnippet, /X-EPE-Site-Key/);

  assert.match(serviceWorker, /Exotic Africa/);
  assert.match(serviceWorker, /EPE_SITE_VAPID_PUBLIC_KEY/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /browser-push-demo/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /acknowledgeDelivery/);

  assert.match(manifest, /"name": "Exotic Africa"/);
  assert.match(manifest, /"start_url": "https:\/\/exotic-africa\.com\/"/);
});
