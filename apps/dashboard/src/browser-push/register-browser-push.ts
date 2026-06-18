import type { SiteSummary } from "../../app/sites/sites.utils";
import { buildBrowserPushDemoMessage } from "./browser-push-demo";

export interface BrowserPushRegistrationResult {
  supported: boolean;
  registered: boolean;
}

export interface BrowserPushSubscriptionResult extends BrowserPushRegistrationResult {
  subscribed: boolean;
  permission: NotificationPermission | "unsupported";
  endpoint: string | null;
}

export interface BrowserPushSubscriptionOptions {
  scriptUrl?: string;
  vapidPublicKey?: string | null;
}

export interface BrowserPushDemoResult {
  supported: boolean;
  registered: boolean;
  sent: boolean;
  permission: NotificationPermission | "unsupported";
  message: string;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = `${normalized}${padding}`;

  if (typeof globalThis.atob === "function") {
    const raw = globalThis.atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      bytes[index] = raw.charCodeAt(index);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export function isBrowserPushSupported(): boolean {
  return (
    typeof globalThis.window !== "undefined" &&
    typeof globalThis.navigator !== "undefined" &&
    "serviceWorker" in globalThis.navigator &&
    "PushManager" in globalThis.window &&
    typeof globalThis.Notification !== "undefined"
  );
}

export async function registerBrowserPushServiceWorker(
  scriptUrl = "/browser-push-sw.js",
): Promise<BrowserPushRegistrationResult> {
  if (!isBrowserPushSupported()) {
    return { supported: false, registered: false };
  }

  const registration = await globalThis.navigator.serviceWorker.register(scriptUrl, { scope: "/" });
  return {
    supported: true,
    registered: Boolean(registration),
  };
}

export async function subscribeBrowserPush(
  options: BrowserPushSubscriptionOptions = {},
): Promise<BrowserPushSubscriptionResult> {
  if (!isBrowserPushSupported()) {
    return {
      supported: false,
      registered: false,
      subscribed: false,
      permission: "unsupported",
      endpoint: null,
    };
  }

  if (globalThis.Notification.permission === "denied") {
    return {
      supported: true,
      registered: false,
      subscribed: false,
      permission: "denied",
      endpoint: null,
    };
  }

  const registration = await globalThis.navigator.serviceWorker.register(options.scriptUrl ?? "/browser-push-sw.js", { scope: "/" });
  const permission =
    globalThis.Notification.permission === "default"
      ? await globalThis.Notification.requestPermission()
      : globalThis.Notification.permission;

  if (permission !== "granted") {
    return {
      supported: true,
      registered: true,
      subscribed: false,
      permission,
      endpoint: null,
    };
  }

  if (!options.vapidPublicKey) {
    return {
      supported: true,
      registered: true,
      subscribed: false,
      permission,
      endpoint: null,
    };
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(options.vapidPublicKey) as unknown as BufferSource,
    }));

  return {
    supported: true,
    registered: true,
    subscribed: true,
    permission,
    endpoint: subscription.endpoint,
  };
}

export async function sendBrowserPushDemoNotification(
  site: Pick<SiteSummary, "name" | "url">,
  scriptUrl = "/browser-push-sw.js",
): Promise<BrowserPushDemoResult> {
  if (!isBrowserPushSupported()) {
    return {
      supported: false,
      registered: false,
      sent: false,
      permission: "unsupported",
      message: "Browser push is not supported in this browser.",
    };
  }

  const permission =
    globalThis.Notification.permission === "default"
      ? await globalThis.Notification.requestPermission()
      : globalThis.Notification.permission;

  if (permission !== "granted") {
    return {
      supported: true,
      registered: false,
      sent: false,
      permission,
      message: "Notification permission is required for the preview.",
    };
  }

  const registration = await globalThis.navigator.serviceWorker.register(scriptUrl, { scope: "/" });
  const readyRegistration = await globalThis.navigator.serviceWorker.ready;
  const workerRegistration = readyRegistration ?? registration;

  if (!workerRegistration.active) {
    return {
      supported: true,
      registered: true,
      sent: false,
      permission,
      message: "The browser push worker is still activating. Try again in a moment.",
    };
  }

  workerRegistration.active.postMessage(buildBrowserPushDemoMessage(site));

  return {
    supported: true,
    registered: true,
    sent: true,
    permission,
    message: `Preview sent for ${site.name}.`,
  };
}
