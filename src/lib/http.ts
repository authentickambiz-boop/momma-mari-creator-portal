import { NextResponse } from "next/server";
import { authorizeBot } from "./bot-api";

export function botGuard(request: Request) {
  const auth = authorizeBot(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });
  return null;
}

export async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
