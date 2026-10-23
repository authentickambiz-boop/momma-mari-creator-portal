import {
  GITHUB_RELEASES_REPO,
  newestWorldsRelease,
  isWorldsGithubAsset,
  rewriteUpdaterManifest,
  safeAssetName,
  type ReleaseAsset,
  type UpdaterManifest,
  type WorldsRelease,
} from "./desktop-update";

const CACHE_MS = 60_000;

let cache: { at: number; release: WorldsRelease | null } | null = null;

function githubHeaders(accept: string) {
  const headers: Record<string, string> = {
    accept,
    "user-agent": "momma-mari-worlds",
  };
  const token = process.env.DESKTOP_UPDATER_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function asAsset(value: unknown): ReleaseAsset | null {
  if (!value || typeof value !== "object") return null;
  const asset = value as { name?: unknown; browser_download_url?: unknown; url?: unknown };
  if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string" || typeof asset.url !== "string") return null;
  const name = safeAssetName(asset.name);
  if (!name) return null;
  return { name, browser_download_url: asset.browser_download_url, url: asset.url };
}

export async function loadNewestWorldsRelease() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.release;
  const response = await fetch(`https://api.github.com/repos/${GITHUB_RELEASES_REPO}/releases?per_page=100`, {
    headers: githubHeaders("application/vnd.github+json"),
    cache: "no-store",
  });
  if (!response.ok) {
    cache = { at: Date.now(), release: null };
    return null;
  }
  const body = await response.json() as unknown;
  const releases = Array.isArray(body)
    ? body.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const release = item as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown };
        if (typeof release.tag_name !== "string" || !Array.isArray(release.assets)) return [];
        return [{
          tag_name: release.tag_name,
          draft: release.draft === true,
          prerelease: release.prerelease === true,
          assets: release.assets.flatMap((asset) => {
            const parsed = asAsset(asset);
            return parsed ? [parsed] : [];
          }),
        }];
      })
    : [];
  const newest = newestWorldsRelease(releases);
  cache = { at: Date.now(), release: newest };
  return newest;
}

export async function releaseDownloadsArePublic(release: WorldsRelease) {
  const asset = release.assets.find((item) => item.name !== "latest.json" && isWorldsGithubAsset(item.browser_download_url)) ?? release.assets[0];
  if (!asset) return true;
  const response = await fetch(asset.browser_download_url, {
    method: "GET",
    headers: { "user-agent": "momma-mari-worlds", range: "bytes=0-0" },
    redirect: "manual",
    cache: "no-store",
  });
  return response.status === 200 || response.status === 206 || response.status === 301 || response.status === 302;
}

export async function loadUpdaterManifest(release: WorldsRelease) {
  const asset = release.assets.find((item) => item.name === "latest.json");
  if (!asset) return null;
  const response = await fetchReleaseAsset(asset);
  if (!response.ok) return null;
  const manifest = await response.json() as UpdaterManifest;
  const anonymous = await releaseDownloadsArePublic(release);
  return rewriteUpdaterManifest(manifest, { anonymous });
}

export function fetchReleaseAsset(asset: ReleaseAsset) {
  const token = process.env.DESKTOP_UPDATER_TOKEN?.trim();
  if (token) {
    return fetch(asset.url, { headers: githubHeaders("application/octet-stream"), redirect: "follow", cache: "no-store" });
  }
  return fetch(asset.browser_download_url, { headers: githubHeaders("application/octet-stream"), redirect: "follow", cache: "no-store" });
}
