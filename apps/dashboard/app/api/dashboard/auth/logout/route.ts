import { NextResponse } from "next/server";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ success: true });
  response.cookies.set("epe_access_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("epe_refresh_token", "", { maxAge: 0, path: "/" });
  return response;
}
