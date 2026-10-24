import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isBotOfficePath } from "@/lib/worlds/office-path";

/** Mark the bot office so the root layout can skip site chrome. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
