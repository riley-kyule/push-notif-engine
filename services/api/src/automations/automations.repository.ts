import type {
  AutomationAction,
  AutomationButton,
  AutomationEventRecord,
  AutomationListFilters,
  AutomationListResult,
  AutomationRecord,
  AutomationStatus,
  AutomationTriggerEvent,
} from "./automations.types";

export interface CreateAutomationInput {
  siteId: string;
  name: string;
  triggerEvent: AutomationTriggerEvent;
  actions: AutomationAction[];
  title: string;
  message: string;
  url: string;
  imageUrl: string | null;
  iconUrl: string | null;
  buttons: AutomationButton[];
  status: AutomationStatus;
}

export interface UpdateAutomationInput {
  name?: string;
  triggerEvent?: AutomationTriggerEvent;
  actions?: AutomationAction[];
  title?: string;
  message?: string;
  url?: string;
  imageUrl?: string | null;
  iconUrl?: string | null;
  buttons?: AutomationButton[];
  status?: AutomationStatus;
}

export interface AutomationsRepository {
  create(input: CreateAutomationInput): Promise<AutomationRecord>;
  update(id: string, input: UpdateAutomationInput): Promise<AutomationRecord | null>;
  findById(id: string): Promise<AutomationRecord | null>;
  delete(id: string): Promise<boolean>;
  list(filters: AutomationListFilters): Promise<AutomationListResult>;
  listActiveByTrigger(siteId: string, triggerEvent: AutomationTriggerEvent): Promise<AutomationRecord[]>;
  recordEvent(input: {
    siteId: string;
    subscriberId?: string | null;
    campaignId?: string | null;
    triggerEvent: AutomationTriggerEvent;
    payload: Record<string, unknown>;
  }): Promise<AutomationEventRecord>;
  markEventCompleted(eventId: string): Promise<void>;
  markEventFailed(eventId: string, errorMessage: string): Promise<void>;
}
