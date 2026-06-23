import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

import type { PermissionSlug } from "../auth.types";

const PERMISSION_SLUGS: PermissionSlug[] = [
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
];

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsArray()
  permissions?: PermissionSlug[];

  static readonly allowedPermissions = PERMISSION_SLUGS;
}
