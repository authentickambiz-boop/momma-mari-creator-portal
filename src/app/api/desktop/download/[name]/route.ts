import { fetchReleaseAsset, loadNewestWorldsRelease } from "@/lib/desktop-update-release";
import { safeAssetName } from "@/lib/desktop-update";

export const dynamic = "force-dynamic";

/** Stream a signed Worlds release asset. The updater checks the signature itself. */
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const assetName = safeAssetName(name);
  if (!assetName) return new Response("Not found", { status: 404 });
  const release = await loadNewestWorldsRelease();
  const asset = release?.assets.find((item) => item.name === assetName);
  if (!asset) return new Response("Not found", { status: 404 });
  const upstream = await fetchReleaseAsset(asset);
  if (!upstream.ok || !upstream.body) return new Response("Update file is unavailable", { status: 502 });
  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
  headers.set("cache-control", "public, max-age=300");
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  return new Response(upstream.body, { headers });
}
