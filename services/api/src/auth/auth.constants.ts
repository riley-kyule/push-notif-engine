export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");
export const AUTH_SERVICE = Symbol("AUTH_SERVICE");
export const TOKEN_SERVICE = Symbol("TOKEN_SERVICE");
export const PASSWORD_SERVICE = Symbol("PASSWORD_SERVICE");

import type { PermissionSlug, RoleSlug } from "./auth.types";

export const ROLE_ORDER = ["super-admin", "admin", "sub-admin", "customer-service"] as const;

export const ROLE_ALIASES: Record<Exclude<RoleSlug, "super-admin" | "admin" | "sub-admin" | "customer-service">, (typeof ROLE_ORDER)[number]> = {
  editor: "sub-admin",
  analyst: "customer-service",
};

export const ROLE_PERMISSION_PRESETS: Record<(typeof ROLE_ORDER)[number], PermissionSlug[]> = {
  "super-admin": [
    "users:manage",
    "roles:manage",
    "automations:manage",
    "sites:manage",
    "sites:settings",
    "analytics:view",
    "subscribers:view",
    "campaigns:manage",
    "campaigns:assigned",
    "campaign-taxonomies:manage",
    "segments:manage",
    "audit-logs:view",
    "system-health:view",
    "backups:manage",
  ],
  admin: [
    "users:manage",
    "automations:manage",
    "sites:manage",
    "sites:settings",
    "analytics:view",
    "subscribers:view",
    "campaigns:manage",
    "campaigns:assigned",
    "campaign-taxonomies:manage",
    "segments:manage",
    "audit-logs:view",
    "system-health:view",
    "backups:manage",
  ],
  "sub-admin": [
    "sites:manage",
    "sites:settings",
    "analytics:view",
    "subscribers:view",
    "campaigns:manage",
    "campaign-taxonomies:manage",
    "segments:manage",
  ],
  "customer-service": ["campaigns:assigned"],
};

export function canonicalRoleSlug(role: RoleSlug): (typeof ROLE_ORDER)[number] {
  if (ROLE_ORDER.includes(role as (typeof ROLE_ORDER)[number])) {
    return role as (typeof ROLE_ORDER)[number];
  }

  return ROLE_ALIASES[role as keyof typeof ROLE_ALIASES];
}
