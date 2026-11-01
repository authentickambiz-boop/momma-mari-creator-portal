/** Webflow Cloud serves portal JS and CSS from a second host. Preconnect skips a fresh DNS and TLS handshake. */
export function assetOriginFromPrefix(prefix: string | null | undefined) {
  const value = prefix?.trim() ?? "";
  if (!value || value.startsWith("/")) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function portalAssetOrigin() {
  const fromEnv = assetOriginFromPrefix(process.env.NEXT_PUBLIC_ASSET_PREFIX || process.env.ASSET_PREFIX);
  if (fromEnv) return fromEnv;
  try {
    const mod = await import("next/dist/server/app-render/work-async-storage.external");
    return assetOriginFromPrefix(mod.workAsyncStorage.getStore()?.assetPrefix);
  } catch {
    return null;
  }
}
