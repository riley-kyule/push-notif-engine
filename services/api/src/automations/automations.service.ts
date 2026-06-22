import { Inject, Injectable, NotFoundException } from "@nestjs/common";
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
  constructor(
    private readonly sitesService: SitesService,
    private readonly auditService: AuditService,
    @Inject(AUTOMATIONS_REPOSITORY) private readonly automationsRepository: AutomationsRepository,
  ) {}

  async createAutomation(dto: CreateAutomationDto, actorUserId?: string): Promise<AutomationRecord> {
    await this.sitesService.getSite(dto.siteId);

    const input: CreateAutomationInput = {
      siteId: dto.siteId,
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

  async deleteAutomation(id: string, actorUserId?: string): Promise<void> {
    const existing = await this.getAutomation(id);
    const deleted = await this.automationsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException("Automation not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "automation.deleted",
      targetType: "automation",
      targetId: id,
      metadata: { siteId: existing.siteId, name: existing.name },
    });
  }
}
