import type { BrowserPushJobPayload } from "./browser-push.types";
import type { BrowserPushRepository } from "./browser-push.repository";
import type { BrowserPushCredentials, BrowserPushSender } from "./browser-push.sender";
import { loadBrowserPushConfig } from "./config";
import { AdaptiveConcurrencyController, chunk, mapWithConcurrency } from "./concurrency.util";
import { decryptVapidPrivateKey } from "./vapid-key-encryption.util";

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

function stableBucket(value: string, range: number): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % range;
}

export function selectNotificationForSubscriber(
  subscriberId: string,
  fallback: BrowserPushJobPayload["notification"],
  variants: NonNullable<BrowserPushJobPayload["variants"]>,
): BrowserPushJobPayload["notification"] {
  const valid = variants.filter((variant) => variant.weight > 0);
  const totalWeight = valid.reduce((total, variant) => total + variant.weight, 0);
  if (totalWeight === 0) return fallback;
  const bucket = stableBucket(subscriberId, totalWeight);
  let cursor = 0;
  for (const variant of valid) {
    cursor += variant.weight;
    if (bucket < cursor) {
      return { ...fallback, title: variant.title, body: variant.body, url: variant.url, variantId: variant.id };
    }
  }
  return fallback;
}

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
      vapidPrivateKey: decryptVapidPrivateKey(site.vapid_private_key),
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
    const adaptiveConcurrency = new AdaptiveConcurrencyController(browserPushConfig.sendConcurrency);

    for (const batch of chunk(subscribers, SEND_BATCH_SIZE)) {
      const notificationBySubscriber = new Map(batch.map((subscriber) => [
        subscriber.id,
        selectNotificationForSubscriber(subscriber.id, job.notification, job.variants ?? []),
      ]));
      // One bulk insert per batch instead of one INSERT per subscriber, and one
      // single multi-hundred-thousand-row insert for the whole job -- bounds how
      // much any single statement or in-memory array has to hold at once.
      const deliveryIdsBySubscriber = await this.repository.createPendingDeliveryEvents({
        siteId: job.siteId,
        campaignId: job.campaignId ?? null,
        automationId: job.automationId ?? null,
        jobId: jobId ?? null,
        retrySourceEventId: job.retrySourceEventId ?? null,
        payload: { ...job.notification, deliveryId: null, ackUrl: null, clickUrl: null },
        subscribers: batch.map((subscriber) => ({
          subscriberId: subscriber.id,
          endpoint: subscriber.subscription_endpoint,
          payload: { ...notificationBySubscriber.get(subscriber.id)!, deliveryId: null, ackUrl: null, clickUrl: null },
        })),
      });

      const results = await mapWithConcurrency(batch, adaptiveConcurrency.current, async (subscriber): Promise<RecipientResult> => {
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
            ...notificationBySubscriber.get(subscriber.id)!,
            deliveryId,
            ackUrl: `${browserPushConfig.ackBaseUrl}/browser-push/deliveries/${deliveryId}/delivered`,
            clickUrl: `${browserPushConfig.ackBaseUrl}/browser-push/deliveries/${deliveryId}/clicked`,
          };
          const result = await this.sendWithRetry(subscription, notification, credentials);
          adaptiveConcurrency.observe(result.attempts > 1);

          await this.repository.markDeliveryEventSent(deliveryId, result.providerMessageId, result.attempts);
          return { kind: "outcome", outcome: "sent" };
        } catch (error) {
          const statusCode = isResponseError(error) ? error.statusCode : undefined;
          const message = isResponseError(error) ? error.message : "Unknown push failure";
          const attempts = isAttemptedError(error) ? error.attempts : 1;
          const errorCode = getPushErrorCode(error, statusCode);

          const pushError: PushError = statusCode ? { statusCode, message } : { message };
          if (isRetryableError(pushError)) {
            adaptiveConcurrency.observe(true);
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
          adaptiveConcurrency.observe(false);

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
        if (jobId) {
          await this.repository.recordInfrastructureIncident({
            jobId,
            siteId: job.siteId,
            campaignId: job.campaignId ?? null,
            errorCode: circuit.error.causeCode,
            errorMessage: circuit.error.message,
            failureCount: circuit.error.failureCount,
          });
        }
        throw circuit.error;
      }

      // Automation/CRM sends commonly target one subscriber. Waiting for the
      // bulk-send circuit threshold here would let the only transient failure
      // complete the BullMQ job and report the campaign as sent, so it would
      // never receive the queue's delayed retries. One exhausted transient is
      // enough to retry a single-recipient job; its pending row is reused by
      // the idempotency guard on the next attempt.
      const targetedTransient = job.subscriberId
        ? results.find((result): result is Extract<RecipientResult, { kind: "transient" }> => result.kind === "transient")
        : undefined;
      if (targetedTransient) {
        const targetedError = new TransientPushInfrastructureError(
          1,
          targetedTransient.errorCode,
          targetedTransient.errorMessage,
        );
        if (jobId) {
          await this.repository.recordInfrastructureIncident({
            jobId,
            siteId: job.siteId,
            campaignId: job.campaignId ?? null,
            errorCode: targetedError.causeCode,
            errorMessage: targetedError.message,
            failureCount: 1,
          });
        }
        throw targetedError;
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
      adaptiveConcurrency.advanceWindow();
    }

    if (job.campaignId) {
      await this.repository.markCampaignSent(job.campaignId);
    }

    if (jobId) {
      await this.repository.markInfrastructureIncidentRecovered(jobId);
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
