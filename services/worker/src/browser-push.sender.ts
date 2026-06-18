import webpush from "web-push";

import type { BrowserPushNotificationPayload } from "./browser-push.types";

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
    });

    return {
      providerMessageId: result.headers.location ?? null,
    };
  }
}
