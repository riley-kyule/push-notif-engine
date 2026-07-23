import type { MobilePushJobPayload, MobilePlatform } from "./mobile-push.types";
import { ApnsMobilePushSender, FcmMobilePushSender, type MobilePushSender } from "./mobile-push.sender";
import type { MobilePushRepository } from "./mobile-push.repository";
import { AdaptiveConcurrencyController, chunk, mapWithConcurrency } from "./concurrency.util";
import { loadMobilePushConfig } from "./config";

// Mirrors BrowserPushProcessor's SEND_BATCH_SIZE -- bounds peak memory for a
// site with a very large device list, same rationale.
const SEND_BATCH_SIZE = 5_000;

function isResponseError(error: unknown): error is { statusCode?: number; message: string } {
  return typeof error === "object" && error !== null && "message" in error;
}

function errorCode(error: unknown, statusCode?: number): string | null {
  if (statusCode) return String(statusCode);
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
}

function isTransient(statusCode?: number): boolean {
  return !statusCode || statusCode === 429 || statusCode >= 500;
}

export class TransientMobilePushInfrastructureError extends Error {
  constructor(
    readonly provider: "apns" | "fcm",
    readonly failureCount: number,
    readonly causeCode: string | null,
    message: string,
  ) {
    super(`Mobile ${provider} infrastructure circuit opened after ${failureCount} transient failures${causeCode ? ` (${causeCode})` : ""}: ${message}`);
    this.name = "TransientMobilePushInfrastructureError";
  }
}

export class MobilePushProcessor {
  private readonly apnsSender: MobilePushSender;
  private readonly fcmSender: MobilePushSender;

  constructor(
    private readonly repository: MobilePushRepository,
    senders?: { apnsSender?: MobilePushSender; fcmSender?: MobilePushSender },
  ) {
    this.apnsSender = senders?.apnsSender ?? new ApnsMobilePushSender();
    this.fcmSender = senders?.fcmSender ?? new FcmMobilePushSender();
  }

  async process(job: MobilePushJobPayload, jobId?: string): Promise<{ sent: number; failed: number; expired: number }> {
    const credentials = await this.repository.findCredentials(job.siteId);
    if (!credentials) {
      throw new Error("Mobile push credentials are missing");
    }

    const allDevices = await this.repository.listEligibleDevices(job.siteId, job.platform);
    const alreadySent = jobId ? await this.repository.findAlreadySentDeviceIds(jobId) : new Set<string>();
    const devices = allDevices.filter((device) => !alreadySent.has(device.id));
    const mobilePushConfig = loadMobilePushConfig();

    type Outcome = "sent" | "failed" | "expired";
    type RecipientResult =
      | { kind: "outcome"; outcome: Outcome }
      | { kind: "transient"; provider: "apns" | "fcm"; errorCode: string | null; errorMessage: string }
      | { kind: "deferred" };
    const totals = { sent: 0, failed: 0, expired: 0 };
    const circuits: Record<"apns" | "fcm", { failures: number; error: TransientMobilePushInfrastructureError | null }> = {
      apns: { failures: 0, error: null },
      fcm: { failures: 0, error: null },
    };
    const adaptiveConcurrency = new AdaptiveConcurrencyController(mobilePushConfig.sendConcurrency);

    for (const batch of chunk(devices, SEND_BATCH_SIZE)) {
      const outcomes = await mapWithConcurrency(batch, adaptiveConcurrency.current, async (device): Promise<RecipientResult> => {
        const sender = device.platform === "ios" ? this.apnsSender : this.fcmSender;
        const provider = device.platform === "ios" ? "apns" : "fcm";
        if (circuits[provider].error) return { kind: "deferred" };

        try {
          const result = await sender.send(
            credentials,
            { deviceToken: device.deviceToken, platform: device.platform },
            job.notification,
          );

          await this.repository.recordDeliveryEvent({
            siteId: job.siteId,
            mobileDeviceId: device.id,
            platform: device.platform,
            deviceToken: device.deviceToken,
            status: "sent",
            providerMessageId: result.providerMessageId,
            errorCode: null,
            errorMessage: null,
            payload: job.notification,
            jobId: jobId ?? null,
          });
          adaptiveConcurrency.observe(false);
          return { kind: "outcome", outcome: "sent" };
        } catch (error) {
          const statusCode = isResponseError(error) ? error.statusCode : undefined;
          const message = isResponseError(error) ? error.message : "Unknown mobile push failure";
          const shouldExpire = statusCode === 404 || statusCode === 410;

          if (isTransient(statusCode)) {
            adaptiveConcurrency.observe(true);
            const circuit = circuits[provider];
            circuit.failures += 1;
            if (circuit.failures >= mobilePushConfig.transientFailureThreshold && !circuit.error) {
              circuit.error = new TransientMobilePushInfrastructureError(provider, circuit.failures, errorCode(error, statusCode), message);
            }
            await this.repository.recordDeliveryEvent({
              siteId: job.siteId,
              mobileDeviceId: device.id,
              platform: device.platform,
              deviceToken: device.deviceToken,
              status: "failed",
              providerMessageId: null,
              errorCode: errorCode(error, statusCode),
              errorMessage: message,
              payload: job.notification,
              jobId: jobId ?? null,
            });
            return circuit.error
              ? { kind: "deferred" }
              : { kind: "transient", provider, errorCode: errorCode(error, statusCode), errorMessage: message };
          }

          await this.repository.recordDeliveryEvent({
            siteId: job.siteId,
            mobileDeviceId: device.id,
            platform: device.platform,
            deviceToken: device.deviceToken,
            status: shouldExpire ? "expired" : "failed",
            providerMessageId: null,
            errorCode: statusCode ? String(statusCode) : null,
            errorMessage: message,
            payload: job.notification,
            jobId: jobId ?? null,
          });
          adaptiveConcurrency.observe(false);

          if (shouldExpire) {
            await this.repository.markDeviceExpired(device.id);
            return { kind: "outcome", outcome: "expired" };
          }

          return { kind: "outcome", outcome: "failed" };
        }
      });

      const opened = Object.values(circuits).map((circuit) => circuit.error).find((error): error is TransientMobilePushInfrastructureError => Boolean(error));
      if (opened) {
        if (jobId) {
          await this.repository.recordInfrastructureIncident({
            provider: opened.provider, jobId, siteId: job.siteId,
            errorCode: opened.causeCode, errorMessage: opened.message, failureCount: opened.failureCount,
          });
        }
        throw opened;
      }

      const smallAudienceTransient = devices.length < mobilePushConfig.transientFailureThreshold
        ? outcomes.find((result): result is Extract<RecipientResult, { kind: "transient" }> => result.kind === "transient")
        : undefined;
      if (smallAudienceTransient) {
        const error = new TransientMobilePushInfrastructureError(
          smallAudienceTransient.provider,
          1,
          smallAudienceTransient.errorCode,
          smallAudienceTransient.errorMessage,
        );
        if (jobId) {
          await this.repository.recordInfrastructureIncident({
            provider: error.provider, jobId, siteId: job.siteId,
            errorCode: error.causeCode, errorMessage: error.message, failureCount: 1,
          });
        }
        throw error;
      }

      for (const result of outcomes) {
        if (result.kind === "outcome") totals[result.outcome] += 1;
        else if (result.kind === "transient") totals.failed += 1;
      }
      adaptiveConcurrency.advanceWindow();
    }

    if (jobId) await this.repository.markInfrastructureIncidentsRecovered(jobId);

    return totals;
  }
}
