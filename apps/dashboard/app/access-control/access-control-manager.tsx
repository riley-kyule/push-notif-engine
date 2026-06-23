"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { AccessControlPermission, AccessControlRole, AccessControlUser, AccessControlUserWithPassword } from "./page";

type Props = {
  initialRoles: AccessControlRole[];
  initialUsers: AccessControlUser[];
};

const PERMISSIONS: AccessControlPermission[] = [
  { slug: "users:manage", label: "Manage users", group: "Access" },
  { slug: "roles:manage", label: "Edit roles and permissions", group: "Access" },
  { slug: "audit-logs:view", label: "View audit logs", group: "Access" },
  { slug: "sites:manage", label: "Manage sites", group: "Sites" },
  { slug: "sites:settings", label: "Edit site settings", group: "Sites" },
  { slug: "subscribers:view", label: "View subscriber data", group: "Audience" },
  { slug: "campaigns:manage", label: "Create and edit campaigns", group: "Campaigns" },
  { slug: "campaigns:assigned", label: "View assigned campaigns", group: "Campaigns" },
  { slug: "campaign-taxonomies:manage", label: "Manage campaign taxonomy", group: "Campaigns" },
  { slug: "segments:manage", label: "Manage audience groups", group: "Automation" },
  { slug: "automations:manage", label: "Manage automations", group: "Automation" },
  { slug: "analytics:view", label: "View analytics", group: "Reporting" },
  { slug: "system-health:view", label: "View system health", group: "Operations" },
  { slug: "backups:manage", label: "Manage backups", group: "Operations" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^\d+/, "");
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function validateNewUserInput(firstName: string, lastName: string, email: string, roleSlug: string): string | null {
  if (firstName.trim().length < 2) {
    return "First name is required.";
  }

  if (lastName.trim().length < 2) {
    return "Last name is required.";
  }

  if (!email.trim()) {
    return "Email is required.";
  }

  if (!roleSlug.trim()) {
    return "Role is required.";
  }

  return null;
}

function prettyRole(role: string): string {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function groupPermissions(permissions: AccessControlPermission[]): Array<{ group: string; items: AccessControlPermission[] }> {
  const buckets = new Map<string, AccessControlPermission[]>();
  for (const permission of permissions) {
    const items = buckets.get(permission.group) ?? [];
    items.push(permission);
    buckets.set(permission.group, items);
  }

  return [...buckets.entries()].map(([group, items]) => ({ group, items }));
}

async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) {
    throw new Error((payload as { error?: { message?: string } } | null)?.error?.message ?? "Request failed");
  }

  return payload;
}

export function AccessControlManager({ initialRoles, initialUsers }: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [users, setUsers] = useState(initialUsers);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState(initialRoles[0]?.slug ?? "super-admin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleSlug, setRoleSlug] = useState(initialRoles[0]?.slug ?? "sub-admin");
  const [status, setStatus] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [revealedCredential, setRevealedCredential] = useState<{ heading: string; username: string; password: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(initialRoles[0]?.permissions ?? []),
  );

  const selectedRole = useMemo(
    () => roles.find((role) => role.slug === selectedRoleSlug) ?? roles[0],
    [roles, selectedRoleSlug],
  );

  const generatedUsername = useMemo(() => {
    const base = slugify(`${firstName}${lastName ? `-${lastName}` : ""}`);
    return base.length > 0 ? base : "username";
  }, [firstName, lastName]);

  const groupedPermissions = useMemo(() => groupPermissions(PERMISSIONS), []);
  const roleCount = roles.length;
  const userCount = users.length;
  const grantedPermissionCount = new Set(roles.flatMap((role) => role.permissions)).size;

  function syncRole(role: AccessControlRole) {
    setSelectedRoleSlug(role.slug);
    setSelectedPermissions(new Set(role.permissions));
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setRevealedCredential(null);

    const validationError = validateNewUserInput(firstName, lastName, email, roleSlug);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    try {
      const result = await postJson<{ success: true; data: AccessControlUserWithPassword }>("/api/dashboard/access-control", {
        firstName,
        lastName,
        email,
        role: roleSlug,
        ...(password.trim() ? { password: password.trim() } : {}),
      });

      setUsers((current) => [result.data, ...current]);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setRoleSlug(initialRoles[0]?.slug ?? "sub-admin");
      setRevealedCredential({ heading: `Created ${result.data.name}`, username: result.data.username, password: result.data.password });
    } catch (error) {
      setStatus(extractErrorMessage(error, "Unable to create user"));
    }
  }

  async function handleResetPassword(user: AccessControlUser) {
    if (!window.confirm(`Reset ${user.name}'s password? Their current password stops working immediately.`)) {
      return;
    }

    setStatus(null);
    setResettingUserId(user.id);
    try {
      const result = await postJson<{ success: true; data: AccessControlUserWithPassword }>(
        `/api/dashboard/access-control/users/${encodeURIComponent(user.id)}/password`,
        {},
        "PATCH",
      );
      setRevealedCredential({ heading: `Reset password for ${user.name}`, username: result.data.username, password: result.data.password });
    } catch (error) {
      setStatus(extractErrorMessage(error, "Unable to reset password"));
    } finally {
      setResettingUserId(null);
    }
  }

  async function handleCopyPassword() {
    if (!revealedCredential) {
      return;
    }

    try {
      await navigator.clipboard.writeText(revealedCredential.password);
      setCopyStatus("Copied.");
      window.setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("Copy failed — select the password manually.");
    }
  }

  async function handleSaveRole() {
    if (!selectedRole) {
      return;
    }

    setSavingRole(selectedRole.slug);
    setStatus(null);
    try {
      const payload = {
        name: selectedRole.name,
        permissions: [...selectedPermissions],
      };
      const result = await postJson<{ success: true; data: AccessControlRole }>(
        `/api/dashboard/access-control/roles/${encodeURIComponent(selectedRole.slug)}`,
        payload,
        "PATCH",
      );
      setRoles((current) => current.map((role) => (role.slug === selectedRole.slug ? result.data : role)));
      setStatus(`Updated ${result.data.name}.`);
    } catch (error) {
      setStatus(extractErrorMessage(error, "Unable to save role"));
    } finally {
      setSavingRole(null);
    }
  }

  async function handleUserRoleChange(userId: string, nextRole: string) {
    setStatus(null);
    try {
      const result = await postJson<{ success: true; data: AccessControlUser }>(
        `/api/dashboard/access-control/users/${encodeURIComponent(userId)}/role`,
        { role: nextRole },
        "PATCH",
      );
      setUsers((current) => current.map((user) => (user.id === userId ? result.data : user)));
      setStatus(`Updated ${result.data.name}'s role.`);
    } catch (error) {
      setStatus(extractErrorMessage(error, "Unable to update user role"));
    }
  }

  return (
    <section className="access-control-workspace">
      <article className="card access-control-intro">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Identity and access</p>
            <h2>Manage user access without leaving the dashboard.</h2>
          </div>
          <span className="badge neutral">Password sign-in</span>
        </div>
        <p className="subtle">
          Add a user with first name, last name, email, and role. Set a password yourself or let the system generate one —
          either way it's shown once, right after you create the account or reset it. Google sign-in is planned for later.
        </p>
        <div className="access-control-role-chips" aria-label="Available roles">
          {roles.map((role) => (
            <span key={role.slug} className="badge neutral">
              {role.name}
            </span>
          ))}
        </div>
      </article>

      {revealedCredential ? (
        <article className="card access-control-credential-reveal">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Shown once — won't be shown again</p>
              <h3>{revealedCredential.heading}</h3>
            </div>
            <button className="button secondary" type="button" onClick={() => setRevealedCredential(null)}>
              Dismiss
            </button>
          </div>
          <div className="access-control-credential-grid">
            <div>
              <p className="subtle">Username</p>
              <p className="mono">@{revealedCredential.username}</p>
            </div>
            <div>
              <p className="subtle">Password</p>
              <p className="mono">{revealedCredential.password}</p>
            </div>
          </div>
          <div className="access-control-actions">
            <button className="button primary" type="button" onClick={handleCopyPassword}>
              Copy password
            </button>
            <span className="subtle">{copyStatus ?? "Share this with the user now — it can't be retrieved later, only reset."}</span>
          </div>
        </article>
      ) : null}

      <section className="grid cards-3">
        <article className="card">
          <p className="eyebrow">Users</p>
          <p className="stat">{userCount}</p>
          <p className="subtle">Accounts with dashboard access</p>
        </article>
        <article className="card">
          <p className="eyebrow">Roles</p>
          <p className="stat">{roleCount}</p>
          <p className="subtle">Managed role profiles</p>
        </article>
        <article className="card">
          <p className="eyebrow">Permissions</p>
          <p className="stat">{grantedPermissionCount}</p>
          <p className="subtle">Unique permissions currently granted</p>
        </article>
      </section>

      <div className="grid cards-2" style={{ alignItems: "start" }}>
        <article className="card access-control-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Add user</p>
              <h2>Invite a new team member</h2>
            </div>
            <span className="badge neutral">Password sign-in</span>
          </div>

          <form className="access-control-form" onSubmit={handleCreateUser} noValidate>
            <div className="access-control-form-grid">
              <label className="field">
                <span>First name</span>
                <input className="input" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Mia" required />
              </label>
              <label className="field">
                <span>Last name</span>
                <input className="input" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Okafor" required />
              </label>
            </div>

            <label className="field">
              <span>Email</span>
              <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="mia@example.com" required />
            </label>

            <div className="access-control-form-grid">
              <label className="field">
                <span>Role</span>
                <select className="select" value={roleSlug} onChange={(event) => setRoleSlug(event.target.value)}>
                  {roles.map((role) => (
                    <option key={role.slug} value={role.slug}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Username</span>
                <input className="input" value={generatedUsername} readOnly />
              </label>
            </div>

            <label className="field">
              <span>Password (optional)</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leave blank to auto-generate"
                autoComplete="new-password"
              />
            </label>

            <div className="access-control-actions">
              <button className="button primary" type="submit">
                Create user
              </button>
              <span className="subtle">Username comes from the first name; the password is shown once after creation.</span>
            </div>
          </form>
        </article>

        <article className="card access-control-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Roles</p>
              <h2>Permission editor</h2>
            </div>
            <span className="badge good">Live</span>
          </div>

          <div className="access-control-role-tabs" role="tablist" aria-label="Role selector">
            {roles.map((role) => (
              <button
                key={role.slug}
                type="button"
                className={`access-control-role-tab ${selectedRoleSlug === role.slug ? "is-active" : ""}`}
                onClick={() => syncRole(role)}
              >
                <strong>{role.name}</strong>
                <span>{role.slug}</span>
              </button>
            ))}
          </div>

          {selectedRole ? (
            <div className="access-control-role-editor">
              <div className="access-control-role-editor-head">
                <div>
                  <p className="eyebrow">{selectedRole.slug}</p>
                  <h3>{selectedRole.name}</h3>
                  <p className="subtle">{selectedPermissions.size} permissions currently granted</p>
                </div>
                <button className="button secondary" type="button" onClick={handleSaveRole} disabled={savingRole === selectedRole.slug}>
                  {savingRole === selectedRole.slug ? "Saving..." : "Save permissions"}
                </button>
              </div>

              <div className="access-control-permission-groups">
                {groupedPermissions.map((group) => (
                  <div key={group.group} className="access-control-permission-group">
                    <p className="access-control-permission-group-title">{group.group}</p>
                    <div className="access-control-permission-list">
                      {group.items.map((permission) => (
                        <label key={permission.slug} className="access-control-permission-item">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(permission.slug)}
                            onChange={(event) => {
                              setSelectedPermissions((current) => {
                                const next = new Set(current);
                                if (event.target.checked) {
                                  next.add(permission.slug);
                                } else {
                                  next.delete(permission.slug);
                                }
                                return next;
                              });
                            }}
                          />
                          <span>
                            <strong>{permission.label}</strong>
                            <small>{permission.slug}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <article className="card access-control-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Users</p>
            <h2>Active accounts</h2>
          </div>
          <span className="badge neutral">{users.length} total users</span>
        </div>

        <div className="table-wrap">
          <table className="table access-control-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Sign-in</th>
                <th>Update role</th>
                <th>Password</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <div className="subtle">{user.isActive ? "Active" : "Inactive"}</div>
                  </td>
                  <td>@{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="badge neutral">{prettyRole(user.role)}</span>
                  </td>
                  <td>{user.authProvider}</td>
                  <td>
                    <div className="access-control-inline">
                      <select className="select" value={user.role} onChange={(event) => void handleUserRoleChange(user.id, event.target.value)}>
                        {roles.map((role) => (
                          <option key={role.slug} value={role.slug}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void handleResetPassword(user)}
                      disabled={resettingUserId === user.id}
                    >
                      {resettingUserId === user.id ? "Resetting..." : "Reset password"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {status ? <p className="access-control-status">{status}</p> : null}
      </article>
    </section>
  );
}
