import { IsIn } from "class-validator";

import type { RoleSlug } from "../auth.types";

const USER_ROLE_SLUGS: RoleSlug[] = ["super-admin", "admin", "sub-admin", "customer-service", "editor", "analyst"];

export class UpdateUserRoleDto {
  @IsIn(USER_ROLE_SLUGS)
  role!: RoleSlug;
}
