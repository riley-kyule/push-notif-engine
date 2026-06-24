import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { SitesService } from "../sites/sites.service";
import { AUTOMATIONS_REPOSITORY } from "./automations.constants";
import type {
  AutomationAction,
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

function normalizeActions(actions: CreateAutomationDto["actions"] | UpdateAutomationDto["actions"] | undefined): AutomationAction[] {
  return (actions ?? []).map((action) => {
    if (action.type === "send_notification") {
      return {
        type: "send_notification",
        title: action.title ?? "",
        message: action.message ?? "",
        url: action.url ?? "",
        imageUrl: action.imageUrl ?? null,
        iconUrl: action.iconUrl ?? null,
        buttons: normalizeButtons(action.buttons),
      };
    }

    if (action.type === "add_tag") {
      return {
        type: "add_tag",
        tag: action.tag ?? "",
      };
    }

    if (action.type === "remove_tag") {
      return {
        type: "remove_tag",
        tag: action.tag ?? "",
      };
    }

    return {
      type: "webhook",
      url: action.url ?? "",
      method: action.method ?? "POST",
      payload: action.payload ?? {},
    };
  });
}

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly sitesService: SitesService,
    private readonly auditService: AuditService,
    @Inject(AUTOMATIONS_REPOSITORY) private readonly automationsRepository: AutomationsRepository,
  ) {}

  async createAutomation(dto: CreateAutomationDto, actorUserId?: string): Promise<AutomationRecord> {
    if (dto.siteId) {
      await this.sitesService.getSite(dto.siteId);
    }

    const input: CreateAutomationInput = {
      siteId: dto.siteId ?? null,
      name: dto.name,
      triggerEvent: dto.triggerEvent,
      actions: normalizeActions(dto.actions),
      title: dto.title,
      message: dto.message,
      url: dto.url,
      imageUrl: dto.imageUrl ?? null,
      iconUrl: dto.iconUrl ?? null,
      buttons: normalizeButtons(dto.buttons),
      status: dto.status ?? "active",
    };

    const automation = await this.automationsRepository.create(input);
    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "automation.created",
      targetType: "automation",
      targetId: automation.id,
      metadata: { siteId: automation.siteId, name: automation.name, triggerEvent: automation.triggerEvent },
    });
    return automation;
  }

  async updateAutomation(id: string, dto: UpdateAutomationDto, actorUserId?: string): Promise<AutomationRecord> {
    const existing = await this.getAutomation(id);

    const input: UpdateAutomationInput = {
      name: dto.name ?? existing.name,
      triggerEvent: dto.triggerEvent ?? existing.triggerEvent,
      actions: dto.actions ? normalizeActions(dto.actions) : existing.actions,
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

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "automation.updated",
      targetType: "automation",
      targetId: updated.id,
      metadata: { changes: dto },
    });

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

  async listActiveByTrigger(siteId: string, triggerEvent: AutomationRecord["triggerEvent"]): Promise<AutomationRecord[]> {
    return this.automationsRepository.listActiveByTrigger(siteId, triggerEvent);
  }

  // Idempotent: skips a default if the site already has any automation on
  // that trigger (default or custom), so re-running this never duplicates.
  async seedDefaultAutomations(siteId: string | null, actorUserId?: string): Promise<AutomationRecord[]> {
    if (!siteId) {
      return this.seedGlobalDefaultAutomations(actorUserId);
    }

    return this.seedDefaultAutomationsForSite(siteId, actorUserId);
  }

  private async seedDefaultAutomationsForSite(siteId: string, actorUserId?: string): Promise<AutomationRecord[]> {
    const site = await this.sitesService.getSite(siteId);
    const existing = await this.automationsRepository.list({ siteId, limit: 100, offset: 0 });
    const existingTriggers = new Set(existing.items.map((automation) => automation.triggerEvent));
    const created: AutomationRecord[] = [];

    if (!existingTriggers.has("subscriber_registered")) {
      created.push(
        await this.createAutomation(
          {
            siteId,
            name: "Welcome push",
            triggerEvent: "subscriber_registered",
            title: `Welcome to ${site.appName}!`,
            message: "Thanks for subscribing - we'll keep you posted with updates you won't want to miss.",
            url: site.url,
            status: "active",
          } as CreateAutomationDto,
          actorUserId,
        ),
      );
    }

    return created;
  }

  private async seedGlobalDefaultAutomations(actorUserId?: string): Promise<AutomationRecord[]> {
    const existing = await this.automationsRepository.list({ limit: 1000, offset: 0 });
    const existingGlobalTriggers = new Set(existing.items.filter((automation) => automation.siteId === null).map((automation) => automation.triggerEvent));
    const created: AutomationRecord[] = [];

    if (!existingGlobalTriggers.has("subscriber_registered")) {
      created.push(
        await this.createAutomation(
          {
            siteId: null,
            name: "Welcome push",
            triggerEvent: "subscriber_registered",
            title: "Welcome to Exotic Push Engine!",
            message: "Thanks for subscribing - we'll keep you posted with updates you won't want to miss.",
            url: "https://example.com",
            status: "active",
          } as CreateAutomationDto,
          actorUserId,
        ),
      );
    }

    return created;
  }

  async deleteAutomation(id: string, actorUserId?: string): Promise<void> {
    const existing = await this.getAutomation(id);
    const deleted = await this.automationsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException("Automation not found");
    }

    void this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "automation.deleted",
      targetType: "automation",
      targetId: id,
      metadata: { siteId: existing.siteId, name: existing.name },
    }).catch((error) => {
      this.logger.error(`Failed to audit deletion for automation ${id}`, error as Error);
    });
  }
}
