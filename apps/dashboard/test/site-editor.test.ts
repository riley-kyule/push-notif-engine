import assert from "node:assert/strict";
import test from "node:test";

import { buildSiteRequestBody, extractApiErrorMessage, normalizeSiteUrl, validateSiteForm } from "../app/sites/site-editor";

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
    optInPromptDisplayMode: "page-views",
    optInPromptScrollPercent: 50,
    optInPromptPageViewCount: 4,
  });

  assert.equal(payload.url, "https://push.example.com");
  assert.equal(payload.vapidPublicKey, "key-value");
  assert.equal(payload.optInPromptDisplayMode, "page-views");
  assert.equal(payload.optInPromptPageViewCount, 4);
});

test("validateSiteForm validates the active prompt display rule", () => {
  const base = {
    name: "Example Site",
    url: "https://example.com",
    country: "KE",
    language: "en",
    platform: "WordPress",
    status: "active" as const,
    vapidPublicKey: "",
    appName: "Example Site",
    iconUrl: "",
    themeColor: "#1c1917",
    optInPromptType: "lightbox-1" as const,
    optInPromptAnimation: "slide-in" as const,
    optInPromptBackgroundColor: "#ffffff",
    optInPromptHeadline: "Stay in the loop",
    optInPromptHeadlineTextColor: "#111111",
    optInPromptText: "Get updates.",
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
    optInPromptScrollPercent: 50,
    optInPromptPageViewCount: 3,
  };

  assert.equal(validateSiteForm({ ...base, optInPromptDisplayMode: "immediate" }), null);
  assert.match(
    validateSiteForm({ ...base, optInPromptDisplayMode: "scroll", optInPromptScrollPercent: 0 }) ?? "",
    /Scroll depth/,
  );
  assert.match(
    validateSiteForm({ ...base, optInPromptDisplayMode: "page-views", optInPromptPageViewCount: 101 }) ?? "",
    /Page views/,
  );
});

test("extractApiErrorMessage returns the API error message", () => {
  assert.equal(
    extractApiErrorMessage({ error: { message: "Site URL must be a valid URL." } }, "Unable to save site"),
    "Site URL must be a valid URL.",
  );
  assert.equal(extractApiErrorMessage(null, "Unable to save site"), "Unable to save site");
});

test("extractApiErrorMessage also handles NestJS's default top-level message shape", () => {
  assert.equal(
    extractApiErrorMessage(
      { statusCode: 409, message: 'A site with the URL "https://example.com" already exists.', error: "Conflict" },
      "Unable to save site",
    ),
    'A site with the URL "https://example.com" already exists.',
  );
  assert.equal(
    extractApiErrorMessage({ statusCode: 400, message: ["name must be longer than 2 characters"] }, "Unable to save site"),
    "name must be longer than 2 characters",
  );
});
