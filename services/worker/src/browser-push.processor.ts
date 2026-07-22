import type { BrowserPushJobPayload } from "./browser-push.types";
import type { BrowserPushRepository } from "./browser-push.repository";
import type { BrowserPushCredentials, BrowserPushSender } from "./browser-push.sender";
import { loadBrowserPushConfig } from "./config";
import { chunk, mapWithConcurrency } from "./concurrency.util";

// A single bulk INSERT (createPendingDeliveryEvents) and a single in-memory
// outcomes array sized to the whole subscriber list both stay comfortably
// small at this size even for a site with hundreds of thousands of active
// subscribers, but processing in batches bounds peak memory and gives a job
// natural points to have already durably committed work if the process is
// killed mid-run (e.g. a deploy's pm2 restart) -- the next attempt's
// findAlreadySentSubscriberIds + the idempotent insert (migration 030)
// together mean a retried job only re-sends to subscribers the previous
// attempt hadn't actually reached yet, regardless of which batch it died in.
const SEND_BATCH_SIZE = 5_000;

type PushError = {
  statusCode?: number;
  body?: string;
  message: string;
};

function isResponseError(error: unknown): error is PushError {
  return typeof error === "object" && error !== null && "message" in error;
}

function isRetryableError(error: PushError): boolean {
  const { statusCode } = error;
  if (!statusCode) {
    // No HTTP status code = network-level failure (DNS resolution, connection
    // refused, TLS handshake timeout, etc.). These are transient relay
    // conditions, not a signal that the subscription is invalid. Treating them
    // as non-retryable was permanently marking valid subscribers as expired
    // every time a push relay had a momentary blip.
    return true;
  }

  return statusCode === 429 || statusCode >= 500;
}

export class TransientPushInfrastructureError extends Error {
  constructor(
    readonly failureCount: number,
    readonly causeCode: string | null,
    causeMessage: string,
  ) {
    super(
      `Browser push infrastructure circuit opened after ${failureCount} transient failures` +
        `${causeCode ? ` (${causeCode})` : ""}: ${causeMessage}`,
    );
    this.name = "TransientPushInfrastructureError";
  }
}

function isAttemptedError(error: unknown): error is { attempts: number } {
  return typeof error === "object" && error !== null && "attempts" in error && typeof (error as { attempts: unknown }).attempts === "number";
}

function getPushErrorCode(error: unknown, statusCode?: number): string | null {
  if (statusCode) {
    return String(statusCode);
  }

  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
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

    const credentials: BrowserPushCredentials = {
      vapidSubject: site.vapid_subject,
      vapidPublicKey: site.vapid_public_key,
      vapidPrivateKey: site.vapid_private_key,
    };

    const allSubscribers = job.subscriberId
      ? await this.repository.findEligibleSubscriberById(job.siteId, job.subscriberId)
      : await this.repository.listEligibleSubscribers(
          job.siteId,
          job.segmentId ? await this.repository.findSegmentDefinition(job.segmentId) : null,
        );

    const alreadySent = jobId ? await this.repository.findAlreadySentSubscriberIds(jobId) : new Set<string>();
    const subscribers = allSubscribers.filter((subscriber) => !alreadySent.has(subscriber.id));

    type Outcome = "sent" | "failed" | "expired";
    type RecipientResult =
      | { kind: "outcome"; outcome: Outcome }
      | { kind: "transient"; deliveryId: string; errorCode: string | null; errorMessage: string; attempts: number }
      | { kind: "deferred" };
    const totals = { sent: 0, failed: 0, expired: 0 };
    const circuit: { failureCount: number; error: TransientPushInfrastructureError | null } = {
      failureCount: 0,
      error: null,
    };

    for (const batch of chunk(subscribers, SEND_BATCH_SIZE)) {
      // One bulk insert per batch instead of one INSERT per subscriber, and one
      // single multi-hundred-thousand-row insert for the whole job -- bounds how
      // much any single statement or in-memory array has to hold at once.
      const deliveryIdsBySubscriber = await this.repository.createPendingDeliveryEvents({
        siteId: job.siteId,
        campaignId: job.campaignId ?? null,
        automationId: job.automationId ?? null,
        jobId: jobId ?? null,
        payload: { ...job.notification, deliveryId: null, ackUrl: null, clickUrl: null },
        subscribers: batch.map((subscriber) => ({
          subscriberId: subscriber.id,
          endpoint: subscriber.subscription_endpoint,
        })),
      });

      const results = await mapWithConcurrency(batch, browserPushConfig.sendConcurrency, async (subscriber): Promise<RecipientResult> => {
        const deliveryId = deliveryIdsBySubscriber.get(subscriber.id);
        if (!deliveryId) {
          return { kind: "outcome", outcome: "failed" };
        }

        // Once the circuit opens, do not start another provider request. The
        // delivery remains pending so BullMQ's later job attempt can reuse it.
        if (circuit.error) {
          return { kind: "deferred" };
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
          const result = await this.sendWithRetry(subscription, notification, credentials);

          await this.repository.markDeliveryEventSent(deliveryId, result.providerMessageId, result.attempts);
          return { kind: "outcome", outcome: "sent" };
        } catch (error) {
          const statusCode = isResponseError(error) ? error.statusCode : undefined;
          const message = isResponseError(error) ? error.message : "Unknown push failure";
          const attempts = isAttemptedError(error) ? error.attempts : 1;
          const errorCode = getPushErrorCode(error, statusCode);

          const pushError: PushError = statusCode ? { statusCode, message } : { message };
          if (isRetryableError(pushError)) {
            circuit.failureCount += 1;
            if (circuit.failureCount >= browserPushConfig.transientFailureThreshold && !circuit.error) {
              circuit.error = new TransientPushInfrastructureError(circuit.failureCount, errorCode, message);
            }

            return {
              kind: "transient",
              deliveryId,
              errorCode,
              errorMessage: message,
              attempts,
            };
          }

          // A 401/403 here means the push service rejected this specific
          // subscription's auth -- permanent for that subscription (the
          // browser revoked permission, cleared site data, the registration
          // was otherwise invalidated, or it was registered under a VAPID key
          // that's since been rotated), the same as 404/410. Already retried
          // up to 3x with backoff in sendWithRetry before reaching here, so
          // this isn't a transient rate-limit blip either.
          const shouldExpire = statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 410;

          await this.repository.markDeliveryEventFailed(deliveryId, {
            status: shouldExpire ? "expired" : "failed",
            errorCode,
            errorMessage: message,
            retryCount: attempts,
          });

          if (shouldExpire) {
            await this.repository.markSubscriberExpired(subscriber.id);
            return { kind: "outcome", outcome: "expired" };
          }

          return { kind: "outcome", outcome: "failed" };
        }
      });

      if (circuit.error) {
        throw circuit.error;
      }

      for (const result of results) {
        if (result.kind === "transient") {
          await this.repository.markDeliveryEventFailed(result.deliveryId, {
            status: "failed",
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
            retryCount: result.attempts,
          });
          totals.failed += 1;
        } else if (result.kind === "outcome") {
          totals[result.outcome] += 1;
        }
      }
    }

    if (job.campaignId) {
      await this.repository.markCampaignSent(job.campaignId);
    }

    // A completed job with zero sent is always worth a warning -- it means
    // either every subscriber was filtered out (missing p256dh/auth keys,
    // already sent in a prior attempt) or the segment matched nobody. Surface
    // it so it doesn't silently disappear into a "completed" BullMQ entry.
    if (totals.sent === 0 && totals.failed === 0 && totals.expired === 0) {
      console.warn(`[browser-push] job ${jobId ?? "unknown"} completed with 0 deliveries (siteId=${job.siteId}, subscribers=${allSubscribers.length})`);
    }

    return totals;
  }

  private async sendWithRetry(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    notification: BrowserPushJobPayload["notification"],
    credentials: BrowserPushCredentials,
  ): Promise<{ providerMessageId: string | null; attempts: number }> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.sender.send(subscription, notification, credentials);
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
