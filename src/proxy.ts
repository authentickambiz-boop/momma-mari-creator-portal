import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { worldsCityEnabled } from "@/lib/worlds/city/flag";
import { isBotOfficePath, isWorldsCityPath } from "@/lib/worlds/office-path";

function fastPortalPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname === "/portal/login" || pathname === "/portal/signup";
}

/** Mark the bot office so the root layout can skip site chrome. Login and sign-up skip the seasonal read. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const fast = fastPortalPath(pathname);
  const city = isWorldsCityPath(pathname) || isWorldsCityPath(pathname, "/portal");
  const office = isBotOfficePath(pathname) || isBotOfficePath(pathname, "/portal");
  if (city && !worldsCityEnabled()) return NextResponse.next();
  if (!office && !fast) return NextResponse.next();
  const requestHeaders = new Headers(request.headers);
  if (office) requestHeaders.set("x-bot-office", "1");
  if (fast) requestHeaders.set("x-portal-fast", "1");
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/worlds",
    "/worlds/create",
    "/worlds/city",
    "/portal/worlds",
    "/portal/worlds/create",
    "/portal/worlds/city",
    "/login",
    "/signup",
    "/portal/login",
    "/portal/signup",
  ],
};
