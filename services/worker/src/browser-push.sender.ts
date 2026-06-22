import https from "node:https";
import webpush from "web-push";

import type { BrowserPushNotificationPayload } from "./browser-push.types";

// Shared keep-alive agent: at high send concurrency, almost every subscriber's push
// service endpoint is one of a handful of hosts (fcm.googleapis.com, Mozilla's
// autopush, Apple's web push gateway). Reusing TLS connections to those hosts instead
// of renegotiating a new handshake per notification is the difference between "fast"
// and "seconds-per-request" once concurrency goes up.
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: Infinity, maxFreeSockets: 256 });

export interface BrowserPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface BrowserPushCredentials {
  vapidSubject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
}

export interface BrowserPushSender {
  configure(credentials: BrowserPushCredentials): void;
  send(subscription: BrowserPushSubscription, payload: BrowserPushNotificationPayload): Promise<{ providerMessageId: string | null }>;
}

export class WebPushSender implements BrowserPushSender {
  configure(credentials: BrowserPushCredentials): void {
    webpush.setVapidDetails(
      credentials.vapidSubject,
      credentials.vapidPublicKey,
      credentials.vapidPrivateKey,
    );
  }

  async send(
    subscription: BrowserPushSubscription,
    payload: BrowserPushNotificationPayload,
  ): Promise<{ providerMessageId: string | null }> {
    const result = await webpush.sendNotification(subscription as never, JSON.stringify(payload), {
      TTL: 60 * 60,
      agent: keepAliveAgent,
    });

    return {
      providerMessageId: result.headers.location ?? null,
    };
  }
}
