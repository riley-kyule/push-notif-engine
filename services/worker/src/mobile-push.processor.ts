import type { MobilePushJobPayload, MobilePlatform } from "./mobile-push.types";
import { ApnsMobilePushSender, FcmMobilePushSender, type MobilePushSender } from "./mobile-push.sender";
import type { MobilePushRepository } from "./mobile-push.repository";

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

  async process(job: MobilePushJobPayload): Promise<{ sent: number; failed: number; expired: number }> {
    const credentials = await this.repository.findCredentials(job.siteId);
    if (!credentials) {
      throw new Error("Mobile push credentials are missing");
    }

    const devices = await this.repository.listEligibleDevices(job.siteId, job.platform);
    let sent = 0;
    let failed = 0;
    let expired = 0;

    for (const device of devices) {
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
        });
        sent += 1;
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
        });

        if (shouldExpire) {
          await this.repository.markDeviceExpired(device.id);
          expired += 1;
        } else {
          failed += 1;
        }
      }
    }

    return { sent, failed, expired };
  }
}
