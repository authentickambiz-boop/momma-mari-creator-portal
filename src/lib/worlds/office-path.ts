/** Office path with the optional portal prefix and any query string removed. */
export function worldsPathname(pathname: string, basePath = "") {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const stripped = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return (stripped.split("?")[0] || "/").replace(/\/+$/, "") || "/";
}

/** True for the owner bot-office route, with or without the portal mount prefix. */
export function isBotOfficePath(pathname: string, basePath = "") {
  const path = worldsPathname(pathname, basePath);
  return path === "/worlds" || path === "/worlds/create" || path === "/worlds/city";
}

export function isWorldsCityPath(pathname: string, basePath = "") {
  return worldsPathname(pathname, basePath) === "/worlds/city";
}
