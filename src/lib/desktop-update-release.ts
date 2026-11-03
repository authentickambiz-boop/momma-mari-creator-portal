import {
  GITHUB_RELEASES_REPO,
  githubAssetIsPublic,
  newestWorldsRelease,
  isWorldsGithubAsset,
  publicLatestJsonUrl,
  rewriteUpdaterManifest,
  safeAssetName,
  worldsTagFromGithubLocation,
  worldsTagsFromAtom,
  type ReleaseAsset,
  type UpdaterManifest,
  type WorldsRelease,
} from "./desktop-update";

const CACHE_MS = 60_000;

let cache: { at: number; release: WorldsRelease | null } | null = null;

function githubHeaders(accept: string, useToken = true) {
  const headers: Record<string, string> = {
    accept,
    "user-agent": "momma-mari-worlds",
  };
  const token = process.env.DESKTOP_UPDATER_TOKEN?.trim();
  if (useToken && token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function hasUpdaterToken() {
  return Boolean(process.env.DESKTOP_UPDATER_TOKEN?.trim());
}

function asAsset(value: unknown): ReleaseAsset | null {
  if (!value || typeof value !== "object") return null;
  const asset = value as { name?: unknown; browser_download_url?: unknown; url?: unknown };
  if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string" || typeof asset.url !== "string") return null;
  const name = safeAssetName(asset.name);
  if (!name) return null;
  return { name, browser_download_url: asset.browser_download_url, url: asset.url };
}

function parseReleaseList(body: unknown): WorldsRelease[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((item) => {
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
  });
}

function releaseFromTag(tag: string | null | undefined): WorldsRelease | null {
  if (!tag) return null;
  const manifestUrl = publicLatestJsonUrl(tag);
  if (!manifestUrl) return null;
  return {
    tag_name: tag,
    assets: [{ name: "latest.json", browser_download_url: manifestUrl, url: manifestUrl }],
  };
}

async function readReleaseList(useToken: boolean) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_RELEASES_REPO}/releases?per_page=100`, {
    headers: githubHeaders("application/vnd.github+json", useToken),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return parseReleaseList(await response.json() as unknown);
}

/** Public feed used when api.github.com is rate-limited or a bad token is set. */
async function loadFromPublicFeed(): Promise<WorldsRelease | null> {
  try {
    const atom = await fetch(`https://github.com/${GITHUB_RELEASES_REPO}/releases.atom`, {
      headers: githubHeaders("application/atom+xml", false),
      cache: "no-store",
    });
    if (atom.ok) {
      const release = releaseFromTag(worldsTagsFromAtom(await atom.text())[0]);
      if (release) return release;
    }
  } catch {
    // The latest redirect below is the second public path.
  }
  try {
    const latest = await fetch(`https://github.com/${GITHUB_RELEASES_REPO}/releases/latest`, {
      headers: githubHeaders("text/html", false),
      redirect: "manual",
      cache: "no-store",
    });
    return releaseFromTag(worldsTagFromGithubLocation(latest.headers.get("location") ?? ""));
  } catch {
    return null;
  }
}

export async function loadNewestWorldsRelease() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.release;
  const token = hasUpdaterToken();
  let newest: WorldsRelease | null = null;
  try {
    let listed = await readReleaseList(token);
    if ((!listed || !newestWorldsRelease(listed)) && token) listed = await readReleaseList(false);
    newest = listed ? newestWorldsRelease(listed) : null;
  } catch {
    newest = null;
  }
  if (!newest) newest = await loadFromPublicFeed();
  if (newest) cache = { at: Date.now(), release: newest };
  return newest;
}

export async function releaseDownloadsArePublic(release: WorldsRelease) {
  const asset = release.assets.find((item) => item.name !== "latest.json" && isWorldsGithubAsset(item.browser_download_url)) ?? release.assets[0];
  if (!asset || !isWorldsGithubAsset(asset.browser_download_url)) return true;
  try {
    const response = await fetch(asset.browser_download_url, {
      method: "GET",
      headers: { "user-agent": "momma-mari-worlds", range: "bytes=0-0" },
      redirect: "manual",
      cache: "no-store",
    });
    return githubAssetIsPublic(response.status, hasUpdaterToken());
  } catch {
    return !hasUpdaterToken();
  }
}

export async function loadUpdaterManifest(release: WorldsRelease) {
  const asset = release.assets.find((item) => item.name === "latest.json");
  if (!asset) return null;
  try {
    const response = await fetchReleaseAsset(asset);
    if (!response.ok) return null;
    const manifest = await response.json() as UpdaterManifest;
    const anonymous = await releaseDownloadsArePublic(release);
    return rewriteUpdaterManifest(manifest, { anonymous });
  } catch {
    return null;
  }
}

export async function fetchReleaseAsset(asset: ReleaseAsset) {
  const token = process.env.DESKTOP_UPDATER_TOKEN?.trim();
  if (token) {
    const authed = await fetch(asset.url, { headers: githubHeaders("application/octet-stream", true), redirect: "follow", cache: "no-store" });
    if (authed.ok) return authed;
    await authed.body?.cancel();
  }
  return fetch(asset.browser_download_url, { headers: githubHeaders("application/octet-stream", false), redirect: "follow", cache: "no-store" });
}
