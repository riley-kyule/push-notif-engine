import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Queue } from "bullmq";

import { SitesService } from "../sites/sites.service";
import { MOBILE_PUSH_JOB_NAME } from "./mobile-push.constants";
import type { MobileClicksRepository } from "./mobile-clicks.repository";
import { UpsertMobileCredentialsDto } from "./dto/upsert-mobile-credentials.dto";
import { RegisterMobileDeviceDto } from "./dto/register-mobile-device.dto";
import { RefreshMobileDeviceDto } from "./dto/refresh-mobile-device.dto";
import { InvalidateMobileDeviceDto } from "./dto/invalidate-mobile-device.dto";
import { CreateMobilePushDispatchDto } from "./dto/create-mobile-push-dispatch.dto";
import type { MobileCredentialsRepository } from "./mobile-credentials.repository";
import type { MobileDevicesRepository } from "./mobile-devices.repository";
import type { MobilePushJobPayload, MobilePushCredentialsRecord, MobileDeviceRecord } from "./mobile-push.types";

export const MOBILE_PUSH_QUEUE = Symbol("MOBILE_PUSH_QUEUE");
export const MOBILE_CREDENTIALS_REPOSITORY = Symbol("MOBILE_CREDENTIALS_REPOSITORY");
export const MOBILE_DEVICES_REPOSITORY = Symbol("MOBILE_DEVICES_REPOSITORY");
export const MOBILE_CLICKS_REPOSITORY = Symbol("MOBILE_CLICKS_REPOSITORY");

@Injectable()
export class MobilePushService {
  constructor(
    private readonly sitesService: SitesService,
    @Inject(MOBILE_CREDENTIALS_REPOSITORY) private readonly credentialsRepository: MobileCredentialsRepository,
    @Inject(MOBILE_DEVICES_REPOSITORY) private readonly devicesRepository: MobileDevicesRepository,
    @Inject(MOBILE_CLICKS_REPOSITORY) private readonly clicksRepository: MobileClicksRepository,
    @Inject(MOBILE_PUSH_QUEUE) private readonly queue: Queue,
  ) {}

  async upsertCredentials(siteId: string, dto: UpsertMobileCredentialsDto): Promise<MobilePushCredentialsRecord> {
    await this.sitesService.getSite(siteId);
    return this.credentialsRepository.upsert({
      siteId,
      apnsKeyId: dto.apnsKeyId ?? null,
      apnsTeamId: dto.apnsTeamId ?? null,
      apnsBundleId: dto.apnsBundleId ?? null,
      apnsPrivateKey: dto.apnsPrivateKey ?? null,
      fcmProjectId: dto.fcmProjectId ?? null,
      fcmClientEmail: dto.fcmClientEmail ?? null,
      fcmPrivateKey: dto.fcmPrivateKey ?? null,
    });
  }

  async getCredentials(siteId: string): Promise<MobilePushCredentialsRecord | null> {
    return this.credentialsRepository.findBySiteId(siteId);
  }

  async registerDevice(dto: RegisterMobileDeviceDto): Promise<MobileDeviceRecord> {
    await this.sitesService.getSite(dto.siteId);
    return this.devicesRepository.register({
      siteId: dto.siteId,
      platform: dto.platform,
      deviceToken: dto.deviceToken,
      country: dto.country ?? null,
      language: dto.language ?? null,
      status: "active",
      lastSeenAt: new Date(),
    });
  }

  async refreshDeviceToken(dto: RefreshMobileDeviceDto): Promise<MobileDeviceRecord> {
    const updated = await this.devicesRepository.refreshToken(
      dto.siteId,
      dto.platform,
      dto.currentDeviceToken,
      dto.nextDeviceToken,
    );
    if (!updated) {
      throw new ServiceUnavailableException("Mobile device token not found");
    }

    return updated;
  }

  async invalidateDevice(dto: InvalidateMobileDeviceDto): Promise<MobileDeviceRecord> {
    const device = await this.devicesRepository.findBySiteAndToken(dto.siteId, dto.platform, dto.deviceToken);
    if (!device) {
      throw new ServiceUnavailableException("Mobile device not found");
    }

    const updated = await this.devicesRepository.updateStatus(device.id, { status: "invalid", lastSeenAt: new Date() });
    if (!updated) {
      throw new ServiceUnavailableException("Mobile device not found");
    }

    return updated;
  }

  async dispatch(dto: CreateMobilePushDispatchDto): Promise<{ jobId: string | undefined; queued: true }> {
    const site = await this.sitesService.getSite(dto.siteId);
    if (!site) {
      throw new ServiceUnavailableException("Site unavailable");
    }

    const credentials = await this.credentialsRepository.findBySiteId(site.id);
    if (!credentials) {
      throw new ServiceUnavailableException("Mobile credentials are not configured for this site");
    }

    const job = await this.queue.add(MOBILE_PUSH_JOB_NAME, {
      siteId: site.id,
      platform: dto.platform,
      notification: {
        title: dto.title,
        body: dto.body,
        url: dto.url,
        icon: dto.icon ?? null,
        image: dto.image ?? null,
      },
      enqueuedAt: new Date().toISOString(),
    } satisfies MobilePushJobPayload);

    return {
      jobId: job.id,
      queued: true,
    };
  }

  async recordClick(siteId: string, platform: "ios" | "android", deviceToken: string, destinationUrl: string): Promise<void> {
    const device = await this.devicesRepository.findBySiteAndToken(siteId, platform, deviceToken);

    await this.clicksRepository.recordClickEvent({
      siteId,
      mobileDeviceId: device?.id ?? null,
      platform,
      deviceToken,
      destinationUrl,
    });
  }
}
