/** True for the owner bot-office route, with or without the portal mount prefix. */
export function isBotOfficePath(pathname: string, basePath = "") {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const stripped = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const path = (stripped.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return path === "/worlds" || path === "/worlds/create" || path === "/worlds/city";
}
