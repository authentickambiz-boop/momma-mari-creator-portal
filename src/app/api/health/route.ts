import { NextResponse } from "next/server";
import { portalHealth } from "@/lib/status-page";

export async function GET() {
  const health = await portalHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 500 });
}
