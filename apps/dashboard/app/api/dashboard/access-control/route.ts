import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/server-api";

export async function GET(): Promise<Response> {
  const [rolesRes, usersRes] = await Promise.all([apiFetch("/access-control/roles"), apiFetch("/access-control/users")]);

  const [roles, users] = await Promise.all([
    rolesRes.json().catch(() => ({ success: false, error: { message: "Invalid API response" } })),
    usersRes.json().catch(() => ({ success: false, error: { message: "Invalid API response" } })),
  ]);

  return NextResponse.json(
    {
      success: true,
      data: {
        roles: roles?.data ?? [],
        users: users?.data ?? [],
      },
    },
    { status: rolesRes.ok && usersRes.ok ? 200 : 502 },
  );
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const res = await apiFetch("/access-control/users", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
