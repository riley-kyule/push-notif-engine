import assert from "node:assert/strict";
import test from "node:test";

import { validateNewUserInput } from "../app/access-control/access-control-manager";
import { validateSiteForm } from "../app/sites/site-editor";

test("create user validation reports missing fields", () => {
  assert.equal(validateNewUserInput("", "Doe", "jane@example.com", "admin"), "First name is required.");
  assert.equal(validateNewUserInput("Jane", "", "jane@example.com", "admin"), "Last name is required.");
  assert.equal(validateNewUserInput("Jane", "Doe", "", "admin"), "Email is required.");
  assert.equal(validateNewUserInput("Jane", "Doe", "jane@example.com", ""), "Role is required.");
});

test("site create validation reports missing fields", () => {
  assert.equal(
    validateSiteForm({
      name: "",
      url: "",
      country: "",
      language: "",
      platform: "",
      status: "active",
      vapidPublicKey: "",
      appName: "",
      iconUrl: "",
      themeColor: "#1c1917",
      optInPromptType: "lightbox-1",
      optInPromptAnimation: "slide-in",
      optInPromptBackgroundColor: "#ffffff",
      optInPromptHeadline: "",
      optInPromptHeadlineTextColor: "#111111",
      optInPromptText: "",
      optInPromptTextColor: "#444444",
      optInPromptIconUrl: "",
      optInPromptCancelButtonLabel: "",
      optInPromptCancelButtonTextColor: "#ffffff",
      optInPromptCancelButtonBackgroundColor: "#111111",
      optInPromptApproveButtonLabel: "",
      optInPromptApproveButtonTextColor: "#ffffff",
      optInPromptApproveButtonBackgroundColor: "#ea580c",
      optInPromptRepromptDelayDays: 30,
      optInPromptRecentNotificationsLimit: 3,
    }),
    "Site name must be at least 2 characters.",
  );
});
