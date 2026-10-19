import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { creators } from "@/db/schema";
import { creatorKnowledge } from "@/lib/deal-rules";
import { normalizeEmail } from "@/lib/format";
import { botGuard } from "@/lib/http";

export async function GET(request: Request) {
  const denied = botGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const creatorId = url.searchParams.get("creator")?.trim() ?? "";
  const email = url.searchParams.get("email")?.trim() ?? "";
  if (!creatorId && !email) {
    return NextResponse.json({ error: "Pass creator or email for one creator." }, { status: 400 });
  }
  const db = await getDb();
  let id = creatorId;
  if (!id && email) {
    const rows = await db.select().from(creators).where(eq(creators.email, normalizeEmail(email)));
    id = rows[0]?.id ?? "";
  }
  if (!id || id === "all") return NextResponse.json({ error: "That creator is not on the roster." }, { status: 404 });
  const knowledge = await creatorKnowledge(db, id);
  if (!knowledge) return NextResponse.json({ error: "That creator is not on the roster." }, { status: 404 });
  return NextResponse.json({ knowledge });
}
