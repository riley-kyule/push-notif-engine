import type {
  CreateRssFeedInput,
  RssFeedRecord,
  SubscriberTagRecord,
  UpdateRssFeedInput,
  WorkflowEventRecord,
} from "./workflow.types";
import type { AutomationTriggerEvent } from "../automations/automations.types";

export interface WorkflowRepository {
  recordEvent(input: {
    siteId: string;
    subscriberId?: string | null;
    campaignId?: string | null;
    triggerEvent: AutomationTriggerEvent;
    payload: Record<string, unknown>;
  }): Promise<WorkflowEventRecord>;
  markEventCompleted(eventId: string): Promise<void>;
  markEventFailed(eventId: string, errorMessage: string): Promise<void>;
  listEvents(filters: { siteId?: string; status?: "pending" | "completed" | "failed"; limit: number; offset: number }): Promise<{ items: WorkflowEventRecord[]; total: number }>;
  addSubscriberTag(subscriberId: string, tag: string): Promise<SubscriberTagRecord>;
  removeSubscriberTag(subscriberId: string, tag: string): Promise<boolean>;
  listSubscriberTags(subscriberId: string): Promise<SubscriberTagRecord[]>;
  createRssFeed(input: CreateRssFeedInput): Promise<RssFeedRecord>;
  updateRssFeed(id: string, input: UpdateRssFeedInput): Promise<RssFeedRecord | null>;
  findRssFeedById(id: string): Promise<RssFeedRecord | null>;
  listRssFeeds(filters: { siteId?: string; status?: "active" | "paused"; limit: number; offset: number }): Promise<{ items: RssFeedRecord[]; total: number }>;
  deleteRssFeed(id: string): Promise<boolean>;
}
