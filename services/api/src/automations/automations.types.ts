export type AutomationTriggerEvent = "subscriber_registered";

export type AutomationStatus = "active" | "paused";

export interface AutomationButton {
  label: string;
  url: string;
}

export interface AutomationRecord {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationListFilters {
  siteId?: string;
  triggerEvent?: AutomationTriggerEvent;
  status?: AutomationStatus;
  limit: number;
  offset: number;
}

export interface AutomationListResult {
  items: AutomationRecord[];
  total: number;
}
