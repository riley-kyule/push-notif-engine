import type { MobilePushJobPayload, MobilePlatform } from "./mobile-push.types";
import { ApnsMobilePushSender, FcmMobilePushSender, type MobilePushSender } from "./mobile-push.sender";
import type { MobilePushRepository } from "./mobile-push.repository";
import { mapWithConcurrency } from "./concurrency.util";
import { loadMobilePushConfig } from "./config";

function isResponseError(error: unknown): error is { statusCode?: number; message: string } {
  return typeof error === "object" && error !== null && "message" in error;
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

    const outcomes = await mapWithConcurrency(devices, mobilePushConfig.sendConcurrency, async (device): Promise<Outcome> => {
      const sender = device.platform === "ios" ? this.apnsSender : this.fcmSender;

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
        return "sent";
      } catch (error) {
        const statusCode = isResponseError(error) ? error.statusCode : undefined;
        const message = isResponseError(error) ? error.message : "Unknown mobile push failure";
        const shouldExpire = statusCode === 404 || statusCode === 410;

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

        if (shouldExpire) {
          await this.repository.markDeviceExpired(device.id);
          return "expired";
        }

        return "failed";
      }
    });

    return {
      sent: outcomes.filter((outcome) => outcome === "sent").length,
      failed: outcomes.filter((outcome) => outcome === "failed").length,
      expired: outcomes.filter((outcome) => outcome === "expired").length,
    };
  }
}
