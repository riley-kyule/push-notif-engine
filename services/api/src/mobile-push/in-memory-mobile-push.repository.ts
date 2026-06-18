import type { MobilePushRepository, MobilePushDeliveryEventInput } from "./mobile-push.repository";
import type { MobileDeviceRecord, MobilePushCredentialsRecord } from "./mobile-push.types";
import type { InMemoryMobileCredentialsRepository } from "./in-memory-mobile-credentials.repository";
import type { InMemoryMobileDevicesRepository } from "./in-memory-mobile-devices.repository";

export class InMemoryMobilePushRepository implements MobilePushRepository {
  public readonly events: MobilePushDeliveryEventInput[] = [];
  constructor(
    private readonly credentialsRepository: InMemoryMobileCredentialsRepository,
    private readonly devicesRepository: InMemoryMobileDevicesRepository,
  ) {}

  async findCredentials(siteId: string): Promise<MobilePushCredentialsRecord | null> {
    return this.credentialsRepository.findBySiteId(siteId);
  }

  async listEligibleDevices(siteId: string, platform: "ios" | "android" | "all"): Promise<MobileDeviceRecord[]> {
    return this.devicesRepository.listEligible(siteId, platform);
  }

  async recordDeliveryEvent(input: MobilePushDeliveryEventInput): Promise<void> {
    this.events.push(input);
  }

  async markDeviceExpired(deviceId: string): Promise<void> {
    await this.devicesRepository.updateStatus(deviceId, { status: "expired" });
  }
}
