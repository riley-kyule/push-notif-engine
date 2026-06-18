import assert from "node:assert/strict";
import test from "node:test";

import {
  isBrowserPushSupported,
  registerBrowserPushServiceWorker,
  subscribeBrowserPush,
} from "../src/browser-push/register-browser-push";

test("browser push registration reports unsupported in node", async () => {
  assert.equal(isBrowserPushSupported(), false);

  const result = await registerBrowserPushServiceWorker();
  assert.deepEqual(result, { supported: false, registered: false });
});

test("browser push subscription registers and subscribes when supported", async () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalNotification = globalThis.Notification;

  const subscription = { endpoint: "https://push.example.com/endpoint" };
  const registerCalls: Array<{ scriptUrl: string; scope: string }> = [];
  const subscribeCalls: Array<{ userVisibleOnly: boolean; applicationServerKey: Uint8Array }> = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { PushManager: function PushManager() {} },
    writable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        async register(scriptUrl: string, options: { scope: string }) {
          registerCalls.push({ scriptUrl, scope: options.scope });
          return {
            pushManager: {
              async getSubscription() {
                return null;
              },
              async subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) {
                subscribeCalls.push(options);
                return subscription;
              },
            },
          };
        },
      },
    },
    writable: true,
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: {
      permission: "default",
      async requestPermission() {
        return "granted";
      },
    },
    writable: true,
  });

  try {
    const result = await subscribeBrowserPush({
      scriptUrl: "/browser-push-sw.js",
      vapidPublicKey: Buffer.from("valid-demo-key").toString("base64url"),
    });

    assert.equal(result.supported, true);
    assert.equal(result.registered, true);
    assert.equal(result.subscribed, true);
    assert.equal(result.permission, "granted");
    assert.equal(result.endpoint, subscription.endpoint);
    assert.deepEqual(registerCalls, [{ scriptUrl: "/browser-push-sw.js", scope: "/" }]);
    assert.equal(subscribeCalls.length, 1);
    assert.equal(subscribeCalls[0]?.userVisibleOnly, true);
    assert.ok(subscribeCalls[0]?.applicationServerKey instanceof Uint8Array);
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
