const PUBLIC_CACHE = "public, max-age=60, s-maxage=120, stale-while-revalidate=600";

/** Logged-out login and sign-up HTML is the same for every visitor. */
export function publicPageCacheControl(pathname: string, hasSession: boolean) {
  if (hasSession) return null;
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const bare = path.replace(/\/portal$/, "") || "/";
  const page = bare.endsWith("/login") || bare.endsWith("/signup") || bare === "/login" || bare === "/signup";
  if (!page) return null;
  return PUBLIC_CACHE;
}
