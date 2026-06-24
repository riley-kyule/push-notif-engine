import { apiJson } from "../../lib/server-api";

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogPage {
  items: AuditLogRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogFilters {
  category?: string | undefined;
  actorRole?: string | undefined;
  createdAfter?: string | undefined;
  createdBefore?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// Verb-phrase, lowercase-first, so it reads naturally as "{actor} {phrase}"
// (e.g. "Admin User created a site") and can still be capitalized on its own.
const ACTION_LABELS: Record<string, string> = {
  "auth.login.success": "logged in",
  "auth.login.failure": "had a failed login attempt",
  "auth.google.login.success": "logged in with Google",
  "auth.google.login.failure": "had a failed Google login attempt",
  "auth.token.refreshed": "refreshed their session",
  "access_control.user_created": "created a user",
  "access_control.user_role_updated": "changed a user's role",
  "access_control.user_password_reset": "reset a user's password",
  "access_control.role_updated": "updated role permissions",
  "site.created": "created a site",
  "site.updated": "updated a site",
  "site.deleted": "deleted a site",
  "site.vapid_generated": "generated VAPID keys",
  "site.rest_api_credentials_generated": "generated REST API credentials",
  "campaign.created": "created a campaign",
  "campaign.updated": "updated a campaign",
  "campaign.deleted": "deleted a campaign",
  "campaign.cloned": "cloned a campaign",
  "campaign.scheduled": "scheduled a campaign",
  "campaign.sent": "sent a campaign",
  "automation.created": "created an automation",
  "automation.updated": "updated an automation",
  "automation.deleted": "deleted an automation",
  "segment.created": "created an audience group",
  "segment.updated": "updated an audience group",
  "segment.deleted": "deleted an audience group",
  "taxonomy.created": "created a content category",
  "taxonomy.updated": "updated a content category",
  "taxonomy.deleted": "deleted a content category",
  "backup.completed": "completed a backup",
  "backup.failed": "had a backup failure",
  "backup.provider_connected": "connected a backup provider",
  "backup.provider_disconnected": "disconnected a backup provider",
  "platform.minor_update_requested": "requested a minor platform update",
  "platform.core_update_requested": "requested a core platform update",
};

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Authentication",
  access_control: "Users & Roles",
  site: "Sites",
  campaign: "Campaigns",
  automation: "Automations",
  segment: "Audience Groups",
  taxonomy: "Categories",
  backup: "Backups",
  platform: "Platform",
};

export function getActionCategory(action: string): string {
  return action.split(".")[0] ?? action;
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replaceAll("_", " ");
}

export function getKnownCategories(): string[] {
  return Object.keys(CATEGORY_LABELS);
}

// Falls back to a readable guess (dots/underscores -> spaces) for any action
// not in the map yet, rather than ever showing nothing.
export function describeAction(row: Pick<AuditLogRow, "action" | "actorName" | "actorEmail">): string {
  const actor = row.actorName ?? row.actorEmail ?? "System";
  const phrase = ACTION_LABELS[row.action] ?? row.action.replaceAll(/[._]/g, " ");
  return `${actor} ${phrase}`;
}

export function getActionLabel(action: string): string {
  const phrase = ACTION_LABELS[action] ?? action.replaceAll(/[._]/g, " ");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function buildAuditQuery(filters: AuditLogFilters): string {
  const search = new URLSearchParams();
  if (filters.category) search.set("category", filters.category);
  if (filters.actorRole) search.set("actorRole", filters.actorRole);
  if (filters.createdAfter) search.set("createdAfter", filters.createdAfter);
  if (filters.createdBefore) search.set("createdBefore", filters.createdBefore);
  search.set("limit", String(filters.limit ?? 25));
  search.set("offset", String(filters.offset ?? 0));
  return search.toString();
}

export async function getAuditLogPage(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const response = await apiJson<{ success?: boolean; data?: AuditLogPage }>(`/audit-logs?${buildAuditQuery(filters)}`);
  return response?.data ?? { items: [], total: 0, limit: filters.limit ?? 25, offset: filters.offset ?? 0 };
}
