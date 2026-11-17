/** Short id a creator can read to Kamron. It is not a secret and contains no account data. */
export function portalErrorRef(digest?: string | null) {
  const clean = (digest ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (clean.length >= 6) return clean.slice(0, 8).toLowerCase();
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Drop tokens and long secrets before anything is written to the server log. */
export function redactPortalLog(text: string) {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/v1:[A-Za-z0-9+/=]{16,}/g, "[redacted]")
    .replace(/\b[0-9a-f]{32,}\b/gi, "[redacted]");
}

/** Log the real error on the server. The creator only sees `ref`. */
export function logPortalError(label: string, error: unknown, digest?: string | null) {
  const ref = portalErrorRef(digest);
  const message = error instanceof Error ? error.message : String(error ?? "");
  const stack = error instanceof Error ? error.stack ?? "" : "";
  console.error(`[portal-error ref=${ref}] ${label}: ${redactPortalLog(message).slice(0, 500)}`);
  if (stack) console.error(`[portal-error ref=${ref}] ${redactPortalLog(stack).slice(0, 2000)}`);
  return ref;
}

/**
 * One data source can fail without taking the page down.
 * The failure is logged with a reference id. The page keeps the fallback.
 */
export async function guardPortal<T>(label: string, fallback: T, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    logPortalError(label, error);
    return fallback;
  }
}
