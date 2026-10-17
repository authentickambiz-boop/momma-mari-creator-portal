import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { listCreators } from "@/lib/queries";

export async function GET() {
  try {
    const db = await getDb();
    const creators = await listCreators(db);
    const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
    return NextResponse.json({ ok: true, storage: onWorkers ? "d1" : "local-sqlite", creators: creators.length });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
