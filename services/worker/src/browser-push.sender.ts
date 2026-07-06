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
  send(
    subscription: BrowserPushSubscription,
    payload: BrowserPushNotificationPayload,
    credentials: BrowserPushCredentials,
  ): Promise<{ providerMessageId: string | null }>;
}

export class WebPushSender implements BrowserPushSender {
  async send(
    subscription: BrowserPushSubscription,
    payload: BrowserPushNotificationPayload,
    credentials: BrowserPushCredentials,
  ): Promise<{ providerMessageId: string | null }> {
    // vapidDetails is passed per-call rather than via the legacy
    // webpush.setVapidDetails() global mutator, which is not concurrency-safe:
    // with up to 5 concurrent jobs for different sites sharing one Node process,
    // a configure() call from job B mid-flight would silently overwrite job A's
    // VAPID credentials, causing every subsequent send in job A to 401/403 and
    // permanently expire valid subscriber subscriptions.
    const result = await webpush.sendNotification(subscription as never, JSON.stringify(payload), {
      // 24 hours: gives devices that are off overnight, or browsers with
      // aggressive background-process killing, a full day to come back online
      // and receive the notification. The previous 1-hour TTL was silently
      // dropping pushes for any subscriber whose device wasn't online within
      // that window. The spec maximum is 28 days (2,419,200s).
      TTL: 24 * 60 * 60,
      urgency: "normal",
      agent: keepAliveAgent,
      vapidDetails: {
        subject: credentials.vapidSubject,
        publicKey: credentials.vapidPublicKey,
        privateKey: credentials.vapidPrivateKey,
      },
    });

    return {
      providerMessageId: result.headers.location ?? null,
    };
  }
}
