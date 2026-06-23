import { DashboardShell } from "../_components/dashboard-shell";
import { apiJson } from "../../lib/server-api";
import { AccessControlManager } from "./access-control-manager";

export type AccessControlPermission = {
  slug: string;
  label: string;
  group: string;
};

export type AccessControlRole = {
  id: string;
  slug: string;
  name: string;
  permissions: string[];
};

export type AccessControlUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  authProvider: "local" | "google";
  lastLoginAt: string | null;
};

// Only present in the response right after creating a user or resetting a
// password — the one moment the plaintext exists.
export type AccessControlUserWithPassword = AccessControlUser & { password: string };

export default async function AccessControlPage() {
  const [rolesResponse, usersResponse] = await Promise.all([
    apiJson<{ success?: boolean; data?: AccessControlRole[] }>("/access-control/roles"),
    apiJson<{ success?: boolean; data?: AccessControlUser[] }>("/access-control/users"),
  ]);

  const roles = (rolesResponse?.data ?? []).filter((role) =>
    ["super-admin", "admin", "sub-admin", "customer-service"].includes(role.slug),
  );
  const users = usersResponse?.data ?? [];

  return (
    <DashboardShell
      eyebrow="Security"
      title="Users & Roles"
      description="Create users, assign roles, and manage permissions from a single workspace."
    >
      <AccessControlManager initialRoles={roles} initialUsers={users} />
    </DashboardShell>
  );
}
