import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { communityActor } from "./community-auth";

export function communityJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "X-Robots-Tag": "noindex" } });
}

export function communityEmpty() {
  return new NextResponse(null, { status: 204, headers: { "X-Robots-Tag": "noindex" } });
}

export async function communityContext() {
  const actor = await communityActor();
  if (!actor) return { response: communityJson({ error: "Sign in required." }, 401) };
  const db = await getDb();
  return { actor, db };
}
