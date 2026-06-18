import assert from "node:assert/strict";
import test from "node:test";

import { buildBrowserPushDemoMessage } from "../src/browser-push/browser-push-demo";
import { sendBrowserPushDemoNotification } from "../src/browser-push/register-browser-push";

test("browser push demo payload is site specific", () => {
  const payload = buildBrowserPushDemoMessage({
    name: "Exotic Africa",
    url: "https://exotic-africa.com",
  });

  assert.equal(payload.type, "browser-push-demo");
  assert.equal(payload.notification.title, "Exotic Africa preview");
  assert.match(payload.notification.body, /Local browser push preview/);
  assert.equal(payload.notification.url, "https://exotic-africa.com");
});

test("browser push demo notification posts a message to the worker", async () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalNotification = globalThis.Notification;

  const postMessageCalls: unknown[] = [];
  const registration = {
    active: {
      postMessage(message: unknown) {
        postMessageCalls.push(message);
      },
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { PushManager: function PushManager() {} },
    writable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        async register() {
          return registration;
        },
        ready: Promise.resolve(registration),
      },
    },
    writable: true,
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: {
      permission: "granted",
      async requestPermission() {
        return "granted";
      },
    },
    writable: true,
  });

  try {
    const result = await sendBrowserPushDemoNotification({
      name: "Exotic Africa",
      url: "https://exotic-africa.com",
    });

    assert.equal(result.sent, true);
    assert.equal(result.registered, true);
    assert.equal(postMessageCalls.length, 1);
    const message = postMessageCalls[0] as { type?: string; notification?: { title?: string } };
    assert.equal(message.type, "browser-push-demo");
    assert.equal(message.notification?.title, "Exotic Africa preview");
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow, writable: true });
    }

    if (originalNavigator === undefined) {
      delete (globalThis as { navigator?: unknown }).navigator;
    } else {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator, writable: true });
    }

    if (originalNotification === undefined) {
      delete (globalThis as { Notification?: unknown }).Notification;
    } else {
      Object.defineProperty(globalThis, "Notification", {
        configurable: true,
        value: originalNotification,
        writable: true,
      });
    }
  }
});
