import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listNewBriefs } from "@/lib/brief-notify";
import { botGuard } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const db = await getDb();
  const result = await listNewBriefs(db);
  return NextResponse.json(result);
}
