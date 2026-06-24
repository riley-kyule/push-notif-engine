import { randomUUID } from "node:crypto";

import type { AutomationEventRecord, AutomationListFilters, AutomationListResult, AutomationRecord, AutomationTriggerEvent } from "./automations.types";
import type { AutomationsRepository, CreateAutomationInput, UpdateAutomationInput } from "./automations.repository";

function cloneAutomation(automation: AutomationRecord): AutomationRecord {
  return {
    ...automation,
    actions: automation.actions.map((action) => ({ ...action })),
    buttons: automation.buttons.map((button) => ({ ...button })),
  };
}

export class InMemoryAutomationsRepository implements AutomationsRepository {
  public readonly automations: AutomationRecord[] = [];

  async create(input: CreateAutomationInput): Promise<AutomationRecord> {
    const now = new Date();
    const automation: AutomationRecord = {
      id: randomUUID(),
      siteId: input.siteId,
      name: input.name,
      triggerEvent: input.triggerEvent,
      actions: input.actions.map((action) => ({ ...action })),
      title: input.title,
      message: input.message,
      url: input.url,
      imageUrl: input.imageUrl,
      iconUrl: input.iconUrl,
      buttons: input.buttons.map((button) => ({ ...button })),
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    this.automations.push(automation);
    return cloneAutomation(automation);
  }

  async update(id: string, input: UpdateAutomationInput): Promise<AutomationRecord | null> {
    const automation = this.automations.find((entry) => entry.id === id);
    if (!automation) {
      return null;
    }

    automation.name = input.name ?? automation.name;
    automation.triggerEvent = input.triggerEvent ?? automation.triggerEvent;
    automation.actions = input.actions ? input.actions.map((action) => ({ ...action })) : automation.actions;
    automation.title = input.title ?? automation.title;
    automation.message = input.message ?? automation.message;
    automation.url = input.url ?? automation.url;
    automation.imageUrl = input.imageUrl === undefined ? automation.imageUrl : input.imageUrl;
    automation.iconUrl = input.iconUrl === undefined ? automation.iconUrl : input.iconUrl;
    automation.buttons = input.buttons ? input.buttons.map((button) => ({ ...button })) : automation.buttons;
    automation.status = input.status ?? automation.status;
    automation.updatedAt = new Date();

    return cloneAutomation(automation);
  }

  async findById(id: string): Promise<AutomationRecord | null> {
    const automation = this.automations.find((entry) => entry.id === id);
    return automation ? cloneAutomation(automation) : null;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.automations.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return false;
    }

    this.automations.splice(index, 1);
    return true;
  }

  async list(filters: AutomationListFilters): Promise<AutomationListResult> {
    const matches = this.automations
      .filter((automation) => !filters.siteId || automation.siteId === filters.siteId || automation.siteId === null)
      .filter((automation) => !filters.triggerEvent || automation.triggerEvent === filters.triggerEvent)
      .filter((automation) => !filters.status || automation.status === filters.status);

    return {
      items: matches.slice(filters.offset, filters.offset + filters.limit).map(cloneAutomation),
      total: matches.length,
    };
  }

  async listActiveByTrigger(siteId: string, triggerEvent: AutomationTriggerEvent): Promise<AutomationRecord[]> {
    return this.automations
      .filter(
        (automation) =>
          (automation.siteId === siteId || automation.siteId === null) &&
          automation.triggerEvent === triggerEvent &&
          automation.status === "active",
      )
      .map(cloneAutomation);
  }

  async recordEvent(input: {
    siteId: string;
    subscriberId?: string | null;
    campaignId?: string | null;
    triggerEvent: AutomationTriggerEvent;
    payload: Record<string, unknown>;
  }): Promise<AutomationEventRecord> {
    const now = new Date();
    const event: AutomationEventRecord = {
      id: randomUUID(),
      siteId: input.siteId,
      subscriberId: input.subscriberId ?? null,
      campaignId: input.campaignId ?? null,
      triggerEvent: input.triggerEvent,
      payload: { ...input.payload },
      status: "pending",
      errorMessage: null,
      executedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return event;
  }

  async markEventCompleted(_eventId: string): Promise<void> {}

  async markEventFailed(_eventId: string, _errorMessage: string): Promise<void> {}
}
