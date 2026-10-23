import { NextResponse } from "next/server";
import { loadNewestWorldsRelease, loadUpdaterManifest } from "@/lib/desktop-update-release";

export const dynamic = "force-dynamic";

/** Public updater manifest. No session and no GitHub login. */
export async function GET() {
  const release = await loadNewestWorldsRelease();
  if (!release) return new Response(null, { status: 204 });
  const manifest = await loadUpdaterManifest(release);
  if (!manifest) return new Response(null, { status: 204 });
  return NextResponse.json(manifest, {
    headers: { "cache-control": "no-store" },
  });
}
