import assert from "node:assert/strict";
import test from "node:test";

import { buildSiteRequestBody, extractApiErrorMessage, normalizeSiteUrl } from "../app/sites/site-editor";

test("normalizeSiteUrl adds https for bare hostnames", () => {
  assert.equal(normalizeSiteUrl("push.exotic-online.com"), "https://push.exotic-online.com");
  assert.equal(normalizeSiteUrl("  https://push.exotic-online.com  "), "https://push.exotic-online.com");
  assert.equal(normalizeSiteUrl(""), "");
});

test("buildSiteRequestBody trims VAPID key and normalizes url", () => {
  const payload = buildSiteRequestBody({
    name: "Example Site",
    url: "push.example.com",
    country: "Kenya",
    language: "en",
    platform: "WordPress",
    status: "active",
    vapidPublicKey: "  key-value  ",
    appName: "Example Site",
    iconUrl: "",
    themeColor: "#1c1917",
    optInPromptType: "lightbox-1",
    optInPromptAnimation: "slide-in",
    optInPromptBackgroundColor: "#ffffff",
    optInPromptHeadline: "Stay in the loop",
    optInPromptHeadlineTextColor: "#111111",
    optInPromptText: "Get important updates delivered to your browser.",
    optInPromptTextColor: "#444444",
    optInPromptIconUrl: "",
    optInPromptCancelButtonLabel: "Not now",
    optInPromptCancelButtonTextColor: "#ffffff",
    optInPromptCancelButtonBackgroundColor: "#111111",
    optInPromptApproveButtonLabel: "Enable",
    optInPromptApproveButtonTextColor: "#ffffff",
    optInPromptApproveButtonBackgroundColor: "#ea580c",
    optInPromptRepromptDelayDays: 30,
    optInPromptRecentNotificationsLimit: 3,
  });

  assert.equal(payload.url, "https://push.example.com");
  assert.equal(payload.vapidPublicKey, "key-value");
});

test("extractApiErrorMessage returns the API error message", () => {
  assert.equal(
    extractApiErrorMessage({ error: { message: "Site URL must be a valid URL." } }, "Unable to save site"),
    "Site URL must be a valid URL.",
  );
  assert.equal(extractApiErrorMessage(null, "Unable to save site"), "Unable to save site");
});
