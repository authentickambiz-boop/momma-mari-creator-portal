/** The only post-login path the desktop office is allowed to return to. */
export const WORLDS_RETURN_PATH = "/worlds";

export const WORLDS_RETURN_COOKIE = "mm_worlds_return";

/**
 * Accept the office path with or without the production mount.
 * Every other value is refused so this cannot become an open redirect.
 */
export function worldsReturnPath(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "/worlds" || trimmed === "/portal/worlds") return WORLDS_RETURN_PATH;
  if (trimmed === "/worlds/create" || trimmed === "/portal/worlds/create") return "/worlds/create";
  return null;
}

export function worldsReturnCookie(header: string | null | undefined) {
  if (!header) return null;
  const prefix = `${WORLDS_RETURN_COOKIE}=`;
  const part = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  if (!part) return null;
  let value = part.slice(prefix.length);
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  return worldsReturnPath(value);
}
