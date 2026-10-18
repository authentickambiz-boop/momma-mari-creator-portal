type HeaderList = { get(name: string): string | null };

/**
 * Cloudflare sets CF-Connecting-IP and overwrites anything the browser sent.
 * If that header is missing, use the last X-Forwarded-For hop (the one a proxy
 * appended) instead of the first value, which the client can spoof.
 */
export function requestClientIp(headerList: HeaderList) {
  const cloudflare = headerList.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const last = hops.at(-1);
    if (last) return last;
  }
  const real = headerList.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
