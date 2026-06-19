import type { BrowserPushJobPayload } from "./browser-push.types";
import type { BrowserPushRepository } from "./browser-push.repository";
import type { BrowserPushSender } from "./browser-push.sender";
import { loadBrowserPushConfig } from "./config";

type PushError = {
  statusCode?: number;
  body?: string;
  message: string;
};

function isResponseError(error: unknown): error is PushError {
  return typeof error === "object" && error !== null && "message" in error;
}

function isRetryableError(error: PushError): boolean {
  const statusCode = error.statusCode;
  if (!statusCode) {
    return false;
  }

  return statusCode === 429 || statusCode >= 500;
}

export class BrowserPushProcessor {
  constructor(
    private readonly repository: BrowserPushRepository,
    private readonly sender: BrowserPushSender,
    private readonly sleep: (ms: number) => Promise<void> = async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
  ) {}

  async process(job: BrowserPushJobPayload): Promise<{ sent: number; failed: number; expired: number }> {
    const browserPushConfig = loadBrowserPushConfig();
    const site = await this.repository.findSiteCredentials(job.siteId);
    if (!site || !site.vapid_subject || !site.vapid_public_key || !site.vapid_private_key) {
      if (job.campaignId) {
        await this.repository.markCampaignFailed(job.campaignId);
      }
      throw new Error("Browser push credentials are missing");
    }

    this.sender.configure({
      vapidSubject: site.vapid_subject,
      vapidPublicKey: site.vapid_public_key,
      vapidPrivateKey: site.vapid_private_key,
    });

    const subscribers = job.subscriberId
      ? await this.repository.findEligibleSubscriberById(job.siteId, job.subscriberId)
      : await this.repository.listEligibleSubscribers(
          job.siteId,
          job.segmentId ? await this.repository.findSegmentDefinition(job.segmentId) : null,
        );
    let sent = 0;
    let failed = 0;
    let expired = 0;

    for (const subscriber of subscribers) {
      const deliveryId = await this.repository.createPendingDeliveryEvent({
        siteId: job.siteId,
        campaignId: job.campaignId ?? null,
        subscriberId: subscriber.id,
        endpoint: subscriber.subscription_endpoint,
        payload: {
          ...job.notification,
          deliveryId: null,
          ackUrl: null,
          clickUrl: null,
        },
      });

      const subscription = {
        endpoint: subscriber.subscription_endpoint,
        keys: {
          p256dh: subscriber.p256dh_key ?? "",
          auth: subscriber.auth_key ?? "",
        },
      };

      try {
        const notification = {
          ...job.notification,
          deliveryId,
          ackUrl: `${browserPushConfig.ackBaseUrl}/browser-push/deliveries/${deliveryId}/delivered`,
          clickUrl: `${browserPushConfig.ackBaseUrl}/browser-push/deliveries/${deliveryId}/clicked`,
        };
        const result = await this.sendWithRetry(subscription, notification);

        await this.repository.markDeliveryEventSent(deliveryId, result.providerMessageId);
        sent += 1;
      } catch (error) {
        const statusCode = isResponseError(error) ? error.statusCode : undefined;
        const message = isResponseError(error) ? error.message : "Unknown push failure";
        const shouldExpire = statusCode === 404 || statusCode === 410;

        await this.repository.markDeliveryEventFailed(deliveryId, {
          status: shouldExpire ? "expired" : "failed",
          errorCode: statusCode ? String(statusCode) : null,
          errorMessage: message,
        });

        if (shouldExpire) {
          await this.repository.markSubscriberExpired(subscriber.id);
          expired += 1;
        } else {
          failed += 1;
        }
      }
    }

    if (job.campaignId) {
      await this.repository.markCampaignSent(job.campaignId);
    }

    return { sent, failed, expired };
  }

  private async sendWithRetry(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    notification: BrowserPushJobPayload["notification"],
  ): Promise<{ providerMessageId: string | null }> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.sender.send(subscription, notification);
      } catch (error) {
        const pushError = isResponseError(error) ? error : { message: "Unknown push failure" };
        const retryable = isRetryableError(pushError);
        const shouldRetry = retryable && attempt < maxAttempts;

        if (!shouldRetry) {
          throw error;
        }

        const backoffMs = 250 * 2 ** (attempt - 1);
        await this.sleep(backoffMs);
      }
    }

    throw new Error("Browser push send retry loop exhausted");
  }
}
