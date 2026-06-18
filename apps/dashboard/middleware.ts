import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIX = ["/login", "/api/dashboard/auth/"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("epe_access_token");
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icon\\.svg|.*\\.png|.*\\.ico).*)"],
};
