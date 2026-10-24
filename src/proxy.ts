import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { worldsCityEnabled } from "@/lib/worlds/follow-camera";
import { isBotOfficePath, isWorldsCityPath } from "@/lib/worlds/office-path";

/** Mark the bot office so the root layout can skip site chrome. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const city = isWorldsCityPath(pathname) || isWorldsCityPath(pathname, "/portal");
  if (city && !worldsCityEnabled()) return NextResponse.next();
  if (!isBotOfficePath(pathname) && !isBotOfficePath(pathname, "/portal")) {
    return NextResponse.next();
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bot-office", "1");
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/worlds", "/worlds/create", "/worlds/city", "/portal/worlds", "/portal/worlds/create", "/portal/worlds/city"],
};
