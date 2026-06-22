import type { BrowserPushJobPayload } from "./browser-push.types";
import type { BrowserPushRepository } from "./browser-push.repository";
import type { BrowserPushSender } from "./browser-push.sender";
import { loadBrowserPushConfig } from "./config";
import { mapWithConcurrency } from "./concurrency.util";

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

function isAttemptedError(error: unknown): error is { attempts: number } {
  return typeof error === "object" && error !== null && "attempts" in error && typeof (error as { attempts: unknown }).attempts === "number";
}

export class BrowserPushProcessor {
  constructor(
    private readonly repository: BrowserPushRepository,
    private readonly sender: BrowserPushSender,
    private readonly sleep: (ms: number) => Promise<void> = async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
  ) {}

  async process(job: BrowserPushJobPayload, jobId?: string): Promise<{ sent: number; failed: number; expired: number }> {
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

    const allSubscribers = job.subscriberId
      ? await this.repository.findEligibleSubscriberById(job.siteId, job.subscriberId)
      : await this.repository.listEligibleSubscribers(
          job.siteId,
          job.segmentId ? await this.repository.findSegmentDefinition(job.segmentId) : null,
        );

    const alreadySent = jobId ? await this.repository.findAlreadySentSubscriberIds(jobId) : new Set<string>();
    const subscribers = allSubscribers.filter((subscriber) => !alreadySent.has(subscriber.id));

    // One bulk insert for the whole batch instead of one INSERT per subscriber —
    // matters once batches reach tens of thousands of rows.
    const deliveryIdsBySubscriber = await this.repository.createPendingDeliveryEvents({
      siteId: job.siteId,
      campaignId: job.campaignId ?? null,
      jobId: jobId ?? null,
      payload: { ...job.notification, deliveryId: null, ackUrl: null, clickUrl: null },
      subscribers: subscribers.map((subscriber) => ({
        subscriberId: subscriber.id,
        endpoint: subscriber.subscription_endpoint,
      })),
    });

    type Outcome = "sent" | "failed" | "expired";

    const outcomes = await mapWithConcurrency(subscribers, browserPushConfig.sendConcurrency, async (subscriber): Promise<Outcome> => {
      const deliveryId = deliveryIdsBySubscriber.get(subscriber.id);
      if (!deliveryId) {
        return "failed";
      }

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

        await this.repository.markDeliveryEventSent(deliveryId, result.providerMessageId, result.attempts);
        return "sent";
      } catch (error) {
        const statusCode = isResponseError(error) ? error.statusCode : undefined;
        const message = isResponseError(error) ? error.message : "Unknown push failure";
        const shouldExpire = statusCode === 404 || statusCode === 410;
        const attempts = isAttemptedError(error) ? error.attempts : 1;

        await this.repository.markDeliveryEventFailed(deliveryId, {
          status: shouldExpire ? "expired" : "failed",
          errorCode: statusCode ? String(statusCode) : null,
          errorMessage: message,
          retryCount: attempts,
        });

        if (shouldExpire) {
          await this.repository.markSubscriberExpired(subscriber.id);
          return "expired";
        }

        return "failed";
      }
    });

    if (job.campaignId) {
      await this.repository.markCampaignSent(job.campaignId);
    }

    return {
      sent: outcomes.filter((outcome) => outcome === "sent").length,
      failed: outcomes.filter((outcome) => outcome === "failed").length,
      expired: outcomes.filter((outcome) => outcome === "expired").length,
    };
  }

  private async sendWithRetry(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    notification: BrowserPushJobPayload["notification"],
  ): Promise<{ providerMessageId: string | null; attempts: number }> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.sender.send(subscription, notification);
        return { ...result, attempts: attempt };
      } catch (error) {
        const pushError = isResponseError(error) ? error : { message: "Unknown push failure" };
        const retryable = isRetryableError(pushError);
        const shouldRetry = retryable && attempt < maxAttempts;

        if (!shouldRetry) {
          if (typeof error === "object" && error !== null) {
            throw Object.assign(error, { attempts: attempt });
          }
          throw error;
        }

        const backoffMs = 250 * 2 ** (attempt - 1);
        await this.sleep(backoffMs);
      }
    }

    throw new Error("Browser push send retry loop exhausted");
  }
}
