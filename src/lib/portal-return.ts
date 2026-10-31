/** The only post-login portal path preserved from the logged-out home redirect. */
export const PORTAL_HOME_RETURN = "/";

export const PORTAL_HOME_COOKIE = "mm_portal_next";

export function portalHomeReturn(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "/" || trimmed === "/portal" || trimmed === "/portal/") return PORTAL_HOME_RETURN;
  return null;
}

export function portalHomeCookie(header: string | null | undefined) {
  if (!header) return null;
  const prefix = `${PORTAL_HOME_COOKIE}=`;
  const part = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  if (!part) return null;
  let value = part.slice(prefix.length);
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  return portalHomeReturn(value);
}
