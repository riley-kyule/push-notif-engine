import type {
  AutomationButton,
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
}
