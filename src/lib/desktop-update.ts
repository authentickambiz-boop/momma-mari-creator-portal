/** Public updater manifest. The desktop app fetches this without a GitHub login. */
export const DESKTOP_UPDATE_URL = "https://www.mommamari.com/portal/api/desktop/latest.json";

export const WORLDS_RELEASE_PREFIX = "worlds-v";

export const GITHUB_RELEASES_REPO = "authentickambiz-boop/momma-mari-creator-portal";

export type ReleaseAsset = {
  name: string;
  browser_download_url: string;
  url: string;
};

export type WorldsRelease = {
  tag_name: string;
  draft?: boolean;
  prerelease?: boolean;
  assets: ReleaseAsset[];
};

export type UpdaterPlatform = {
  signature: string;
  url: string;
};

export type UpdaterManifest = {
  version: string;
  notes?: string;
  pub_date?: string;
  platforms: Record<string, UpdaterPlatform>;
};

const ASSET_NAME = /^[A-Za-z0-9._+ -]+$/;

export function worldsReleaseVersion(tag: string) {
  if (!tag.startsWith(WORLDS_RELEASE_PREFIX)) return null;
  const version = tag.slice(WORLDS_RELEASE_PREFIX.length);
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  return version;
}

export function compareVersions(left: string, right: string) {
  const a = left.split(".").map((part) => Number(part));
  const b = right.split(".").map((part) => Number(part));
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function newestWorldsRelease(releases: WorldsRelease[]) {
  let best: WorldsRelease | null = null;
  let bestVersion = "";
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    const version = worldsReleaseVersion(release.tag_name);
    if (!version) continue;
    if (!best || compareVersions(version, bestVersion) > 0) {
      best = release;
      bestVersion = version;
    }
  }
  return best;
}

export function safeAssetName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return null;
  if (!ASSET_NAME.test(trimmed)) return null;
  return trimmed;
}

export function updaterDownloadName(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const name = decodeURIComponent(parsed.pathname.split("/").pop() || "");
    return safeAssetName(name);
  } catch {
    return null;
  }
}

export function desktopDownloadUrl(name: string) {
  return `https://www.mommamari.com/portal/api/desktop/download/${encodeURIComponent(name)}`;
}

/** Tag from a GitHub `/releases/tag/` or `/releases/latest` redirect. Other hosts are refused. */
export function worldsTagFromGithubLocation(location: string) {
  try {
    const url = new URL(location);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const prefix = `/${GITHUB_RELEASES_REPO}/releases/tag/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const tag = decodeURIComponent(url.pathname.slice(prefix.length).split("/")[0] || "");
    if (!worldsReleaseVersion(tag)) return null;
    return tag;
  } catch {
    return null;
  }
}

/** Newest worlds-v tags in a public releases Atom feed, newest first. */
export function worldsTagsFromAtom(xml: string) {
  const tags: string[] = [];
  const pattern = /\/releases\/tag\/(worlds-v\d+\.\d+\.\d+)\b/g;
  for (const match of xml.matchAll(pattern)) {
    const tag = match[1];
    if (worldsReleaseVersion(tag) && !tags.includes(tag)) tags.push(tag);
  }
  tags.sort((left, right) => compareVersions(worldsReleaseVersion(right) || "0.0.0", worldsReleaseVersion(left) || "0.0.0"));
  return tags;
}

export function publicLatestJsonUrl(tag: string) {
  if (!worldsReleaseVersion(tag)) return null;
  return `https://github.com/${GITHUB_RELEASES_REPO}/releases/download/${tag}/latest.json`;
}

/**
 * 200 and redirects mean the asset can be downloaded without a login.
 * 404 is how GitHub hides a private release. 403 is often a shared-IP limit.
 */
export function githubAssetIsPublic(status: number, hasToken: boolean) {
  if (status === 200 || status === 206 || status === 301 || status === 302) return true;
  if (status === 404 || status === 401) return false;
  return !hasToken;
}

/** A public GitHub release asset. No login is required while the repo stays public. */
export function isWorldsGithubAsset(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && parsed.hostname === "github.com"
      && parsed.pathname.startsWith("/authentickambiz-boop/momma-mari-creator-portal/releases/download/");
  } catch {
    return false;
  }
}

/**
 * Keep public GitHub asset URLs when the release can be downloaded anonymously.
 * Otherwise point at the portal, which streams the same bytes. Signatures are unchanged.
 */
export function rewriteUpdaterManifest(manifest: UpdaterManifest, options?: { anonymous?: boolean }) {
  if (!manifest || typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.version)) return null;
  const anonymous = options?.anonymous !== false;
  const platforms: Record<string, UpdaterPlatform> = {};
  const entries = Object.entries(manifest.platforms ?? {});
  if (!entries.length) return null;
  for (const [key, platform] of entries) {
    if (!/^[a-z0-9_-]+$/.test(key)) return null;
    if (!platform || typeof platform.signature !== "string" || !platform.signature.trim()) return null;
    if (typeof platform.url !== "string") return null;
    const name = updaterDownloadName(platform.url);
    if (!name) return null;
    const url = anonymous && isWorldsGithubAsset(platform.url) ? platform.url : desktopDownloadUrl(name);
    platforms[key] = { signature: platform.signature, url };
  }
  return {
    version: manifest.version,
    notes: typeof manifest.notes === "string" ? manifest.notes : undefined,
    pub_date: typeof manifest.pub_date === "string" ? manifest.pub_date : undefined,
    platforms,
  };
}
