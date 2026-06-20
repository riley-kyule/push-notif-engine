export type AutomationTriggerEvent = "subscriber_registered" | "page_visit" | "click" | "api_event" | "rss_item_published";

export type AutomationStatus = "active" | "paused";

export type AutomationActionType = "send_notification" | "add_tag" | "remove_tag" | "webhook";

export interface AutomationNotificationAction {
  type: "send_notification";
  title: string;
  message: string;
  url: string;
  imageUrl: string | null;
  iconUrl: string | null;
  buttons: AutomationButton[];
}

export interface AutomationAddTagAction {
  type: "add_tag";
  tag: string;
}

export interface AutomationRemoveTagAction {
  type: "remove_tag";
  tag: string;
}

export interface AutomationWebhookAction {
  type: "webhook";
  url: string;
  method: "POST" | "PUT" | "PATCH";
  payload: Record<string, unknown>;
}

export type AutomationAction =
  | AutomationNotificationAction
  | AutomationAddTagAction
  | AutomationRemoveTagAction
  | AutomationWebhookAction;

export interface AutomationButton {
  label: string;
  url: string;
}

export interface AutomationRecord {
  id: string;
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

export interface AutomationEventRecord {
  id: string;
  siteId: string;
  subscriberId: string | null;
  campaignId: string | null;
  triggerEvent: AutomationTriggerEvent;
  payload: Record<string, unknown>;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
