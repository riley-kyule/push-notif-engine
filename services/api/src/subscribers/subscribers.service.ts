import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { SUBSCRIBERS_REPOSITORY } from "./subscribers.constants";
import type { SubscribersRepository } from "./subscribers.repository";
import type { SubscriberListFilters, SubscriberListResult, SubscriberRecord } from "./subscribers.types";
import { RegisterSubscriberDto } from "./dto/register-subscriber.dto";
import { ListSubscribersQueryDto } from "./dto/list-subscribers-query.dto";
import { UpdateSubscriberStatusDto } from "./dto/update-subscriber-status.dto";

@Injectable()
export class SubscribersService {
  constructor(@Inject(SUBSCRIBERS_REPOSITORY) private readonly subscribersRepository: SubscribersRepository) {}

  async registerSubscriber(dto: RegisterSubscriberDto): Promise<SubscriberRecord> {
    return this.subscribersRepository.upsert({
      siteId: dto.siteId,
      browser: dto.browser,
      deviceType: dto.deviceType,
      country: dto.country ?? "Unknown",
      language: dto.language,
      subscriptionEndpoint: dto.subscriptionEndpoint,
      p256dhKey: dto.p256dhKey ?? null,
      authKey: dto.authKey ?? null,
      status: dto.status ?? "active",
      lastSeenAt: new Date(),
    });
  }

  async listSubscribers(query: ListSubscribersQueryDto): Promise<SubscriberListResult> {
    const filters: SubscriberListFilters = {
      limit: query.limit,
      offset: query.offset,
    };

    if (query.siteId) filters.siteId = query.siteId;
    if (query.search) filters.search = query.search;
    if (query.status) filters.status = query.status;
    if (query.browser) filters.browser = query.browser;
    if (query.deviceType) filters.deviceType = query.deviceType;
    if (query.country) filters.country = query.country;
    if (query.language) filters.language = query.language;

    return this.subscribersRepository.list(filters);
  }

  async getSubscriber(id: string): Promise<SubscriberRecord> {
    const subscriber = await this.subscribersRepository.findById(id);
    if (!subscriber) {
      throw new NotFoundException("Subscriber not found");
    }

    return subscriber;
  }

  async updateStatus(id: string, dto: UpdateSubscriberStatusDto): Promise<SubscriberRecord> {
    const updated = await this.subscribersRepository.updateStatus(id, {
      status: dto.status,
      lastSeenAt: dto.lastSeenAt ? new Date(dto.lastSeenAt) : null,
    });
    if (!updated) {
      throw new NotFoundException("Subscriber not found");
    }

    return updated;
  }
}
