import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { BrowserPushService } from "../browser-push/browser-push.service";
import { SitesService } from "../sites/sites.service";
import type { SubscriberRecord } from "../subscribers/subscribers.types";
import { AUTOMATIONS_REPOSITORY } from "./automations.constants";
import type {
  AutomationButton,
  AutomationListFilters,
  AutomationListResult,
  AutomationRecord,
} from "./automations.types";
import type { AutomationsRepository, CreateAutomationInput, UpdateAutomationInput } from "./automations.repository";
import { CreateAutomationDto } from "./dto/create-automation.dto";
import { ListAutomationsQueryDto } from "./dto/list-automations-query.dto";
import { UpdateAutomationDto } from "./dto/update-automation.dto";

function normalizeButtons(buttons: CreateAutomationDto["buttons"] | UpdateAutomationDto["buttons"]): AutomationButton[] {
  return (buttons ?? []).map((button) => ({ label: button.label, url: button.url }));
}

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly sitesService: SitesService,
    private readonly browserPushService: BrowserPushService,
    @Inject(AUTOMATIONS_REPOSITORY) private readonly automationsRepository: AutomationsRepository,
  ) {}

  async createAutomation(dto: CreateAutomationDto): Promise<AutomationRecord> {
    await this.sitesService.getSite(dto.siteId);

    const input: CreateAutomationInput = {
      siteId: dto.siteId,
      name: dto.name,
      triggerEvent: dto.triggerEvent,
      title: dto.title,
      message: dto.message,
      url: dto.url,
      imageUrl: dto.imageUrl ?? null,
      iconUrl: dto.iconUrl ?? null,
      buttons: normalizeButtons(dto.buttons),
      status: dto.status ?? "active",
    };

    return this.automationsRepository.create(input);
  }

  async updateAutomation(id: string, dto: UpdateAutomationDto): Promise<AutomationRecord> {
    const existing = await this.getAutomation(id);

    const input: UpdateAutomationInput = {
      name: dto.name ?? existing.name,
      triggerEvent: dto.triggerEvent ?? existing.triggerEvent,
      title: dto.title ?? existing.title,
      message: dto.message ?? existing.message,
      url: dto.url ?? existing.url,
      imageUrl: dto.imageUrl === undefined ? existing.imageUrl : dto.imageUrl,
      iconUrl: dto.iconUrl === undefined ? existing.iconUrl : dto.iconUrl,
      buttons: dto.buttons ? normalizeButtons(dto.buttons) : existing.buttons,
      status: dto.status ?? existing.status,
    };

    const updated = await this.automationsRepository.update(id, input);
    if (!updated) {
      throw new NotFoundException("Automation not found");
    }

    return updated;
  }

  async getAutomation(id: string): Promise<AutomationRecord> {
    const automation = await this.automationsRepository.findById(id);
    if (!automation) {
      throw new NotFoundException("Automation not found");
    }

    return automation;
  }

  async listAutomations(query: ListAutomationsQueryDto): Promise<AutomationListResult> {
    const filters: AutomationListFilters = {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };

    if (query.siteId) filters.siteId = query.siteId;
    if (query.triggerEvent) filters.triggerEvent = query.triggerEvent;
    if (query.status) filters.status = query.status;

    return this.automationsRepository.list(filters);
  }

  async deleteAutomation(id: string): Promise<void> {
    const deleted = await this.automationsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException("Automation not found");
    }
  }

  async handleSubscriberRegistered(subscriber: SubscriberRecord): Promise<void> {
    if (!subscriber.p256dhKey || !subscriber.authKey) {
      // Subscriber registered without push keys (both optional on RegisterSubscriberDto).
      // The worker's eligibility query requires both keys, so dispatching now would
      // silently no-op. Skip until the subscriber re-registers with keys present.
      return;
    }

    const automations = await this.automationsRepository.listActiveByTrigger(subscriber.siteId, "subscriber_registered");

    for (const automation of automations) {
      try {
        await this.browserPushService.dispatch({
          siteId: automation.siteId,
          subscriberId: subscriber.id,
          title: automation.title,
          body: automation.message,
          url: automation.url,
          icon: automation.iconUrl,
          image: automation.imageUrl,
        });
      } catch (error) {
        // Isolate failures per automation so one bad dispatch (e.g. missing VAPID
        // credentials) doesn't prevent the remaining automations from running.
        this.logger.error(`Failed to dispatch automation ${automation.id} for subscriber ${subscriber.id}`, error as Error);
      }
    }
  }
}
