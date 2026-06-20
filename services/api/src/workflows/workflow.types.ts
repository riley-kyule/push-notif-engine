import type { AutomationAction, AutomationTriggerEvent } from "../automations/automations.types";

export interface WorkflowEventRecord {
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

export interface SubscriberTagRecord {
  id: string;
  subscriberId: string;
  tag: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RssFeedRecord {
  id: string;
  siteId: string;
  name: string;
  feedUrl: string;
  status: "active" | "paused";
  lastItemGuid: string | null;
  lastItemTitle: string | null;
  lastItemUrl: string | null;
  lastItemPublishedAt: Date | null;
  lastPolledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRssFeedInput {
  siteId: string;
  name: string;
  feedUrl: string;
  status: "active" | "paused";
}

export interface UpdateRssFeedInput {
  name?: string;
  feedUrl?: string;
  status?: "active" | "paused";
  lastItemGuid?: string | null;
  lastItemTitle?: string | null;
  lastItemUrl?: string | null;
  lastItemPublishedAt?: Date | null;
  lastPolledAt?: Date | null;
}

export interface WorkflowActionContext {
  siteId: string;
  subscriberId: string | null;
  campaignId: string | null;
  triggerEvent: AutomationTriggerEvent;
  payload: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  automationId: string;
  actions: AutomationAction[];
}
