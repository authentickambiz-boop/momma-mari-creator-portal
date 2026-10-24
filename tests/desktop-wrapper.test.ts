import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { compareVersions, desktopDownloadUrl, githubAssetIsPublic, newestWorldsRelease, publicLatestJsonUrl, rewriteUpdaterManifest, safeAssetName, worldsReleaseVersion, worldsTagFromGithubLocation, worldsTagsFromAtom } from "../src/lib/desktop-update";
import { worldsReturnCookie, worldsReturnPath } from "../src/lib/worlds/office-return";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Momma Mari Worlds desktop", () => {
  test("the Tauri window opens the live office, remembers its place, and sends grokbot links out", () => {
    const main = [
      source("desktop/src-tauri/src/main.rs"),
      source("desktop/src-tauri/src/office_lock.rs"),
    ].join("\n");
    assert.match(source("desktop/src-tauri/src/main.rs"), /mod office_lock/);
    const config = source("desktop/src-tauri/tauri.conf.json");
    const workflow = source(".github/workflows/desktop.yml");
    const readme = source("README.md");

    assert.match(main, /https:\/\/www\.mommamari\.com\/portal\/worlds/);
    assert.match(main, /\/portal\/login/);
    assert.match(main, /\/portal\/api\/auth/);
    assert.match(main, /\/portal\/api\/worlds/);
    assert.match(main, /portal-side/);
    assert.match(main, /account-menu/);
    assert.match(main, /navigation_allowed/);
    assert.match(main, /Quit and fullscreen only/);
    assert.equal(main.includes("Brand deals"), false);
    assert.equal(main.includes("Open the portal"), false);
    assert.match(main, /grokbot/);
    assert.match(main, /open::that/);
    assert.match(main, /StateFlags::POSITION/);
    assert.match(main, /StateFlags::SIZE/);
    assert.match(main, /Toggle Fullscreen/);
    assert.match(main, /F11/);
    assert.match(main, /Momma Mari Worlds/);
    assert.match(main, /Updating…/);
    assert.match(main, /install_update/);
    assert.match(main, /tauri_plugin_updater/);
    assert.match(main, /WORLDS_LAUNCH url=/);
    assert.match(main, /updater=check/);
    assert.match(main, /WORLDS_UPDATER result=/);
    assert.match(main, /launch_url_from_assets/);
    assert.match(config, /"version": "0\.1\.3"/);
    assert.match(source("desktop/package.json"), /"version": "0\.1\.3"/);
    assert.match(source("desktop/src-tauri/Cargo.toml"), /version = "0\.1\.3"/);
    assert.match(main, /accounts\.google\.com/);
    assert.match(main, /host_is_google_auth/);
    assert.equal(main.includes("host_is(host, \"google.com\")"), false);
    assert.equal(main.includes("mail.google.com"), false);
    assert.match(config, /"productName": "Momma Mari Worlds"/);
    assert.match(config, /createUpdaterArtifacts": true/);
    assert.match(config, /https:\/\/www\.mommamari\.com\/portal\/api\/desktop\/latest\.json/);
    assert.match(config, /releases\/latest\/download\/latest\.json/);
    assert.match(config, /"\.\.\/assets\/": "assets\/"/);
    assert.match(config, /assets\/building\.png/);
    assert.match(config, /"installMode": "quiet"/);
    assert.match(config, /dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6/);
    assert.equal(config.includes("minisign secret key"), false);
    assert.match(config, /"identifier": "com\.mommamari\.worlds"/);
    assert.match(config, /nsis/);
    assert.match(config, /dmg/);
    assert.equal(config.includes("withGlobalTauri\": true"), false);

    for (const icon of ["32x32.png", "128x128.png", "128x128@2x.png", "icon.icns", "icon.ico"]) {
      assert.equal(existsSync(path.join("desktop/src-tauri/icons", icon)), true, icon);
    }

    assert.match(workflow, /npm ci/);
    assert.match(workflow, /windows-latest/);
    assert.match(workflow, /macos-latest/);
    assert.match(workflow, /upload-artifact/);
    assert.match(workflow, /--bundles nsis/);
    assert.match(workflow, /--bundles dmg/);
    assert.match(workflow, /action-gh-release/);
    assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY/);
    assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY_PASSWORD/);
    assert.match(workflow, /matrix\.os == 'windows-latest'\) && 'worlds-v__VERSION__'/);
    assert.match(workflow, /updaterJsonPreferNsis: true/);
    assert.match(workflow, /sign != 'true' && ' --config updater-unsigned\.json'/);
    assert.match(source("desktop/updater-unsigned.json"), /"createUpdaterArtifacts": false/);
    assert.equal(workflow.includes("minisign secret key"), false);

    assert.match(readme, /www\.mommamari\.com\/portal\/worlds/);
    assert.match(readme, /Pin to taskbar/);
    assert.match(readme, /Keep in Dock/);
    assert.match(readme, /momma-mari-worlds-windows-latest/);
    assert.match(readme, /momma-mari-worlds-macos-latest/);
    assert.match(readme, /grokbot:\/\//);
    assert.match(readme, /Updating…/);
    assert.match(readme, /portal\/api\/desktop\/latest\.json/);
    assert.match(readme, /0\.1\.2/);
    assert.match(readme, /0\.1\.3/);
    assert.match(readme, /desktop\/assets\/game\.json/);
    assert.match(readme, /setup\.exe \/S/);
    const game = JSON.parse(source("desktop/assets/game.json")) as { mode: string; url: string; ownerOnly: boolean; localGame: { ready: boolean; art: string } };
    assert.equal(game.mode, "webview");
    assert.equal(game.url, "https://www.mommamari.com/portal/worlds");
    assert.equal(game.ownerOnly, true);
    assert.equal(game.localGame.ready, false);
    assert.equal(game.localGame.art, "building.png");
    assert.equal(source("desktop/dist/index.html").includes("https://mommamari.com/worlds"), false);
    assert.match(source("desktop/dist/index.html"), /https:\/\/www\.mommamari\.com\/portal\/worlds/);
    assert.match(source("src/app/api/desktop/latest/route.ts"), /loadUpdaterManifest/);
    assert.match(source("src/app/api/desktop/download/[name]/route.ts"), /fetchReleaseAsset/);
    assert.match(source("next.config.ts"), /\/api\/desktop\/latest\.json/);
    assert.equal(source("desktop/src-tauri/capabilities/default.json").includes("updater:default"), false);
  });

  test("sign-in can return only to the office", () => {
    assert.equal(worldsReturnPath("/worlds"), "/worlds");
    assert.equal(worldsReturnPath("/portal/worlds"), "/worlds");
    assert.equal(worldsReturnPath("/"), null);
    assert.equal(worldsReturnPath("/worlds/extra"), null);
    assert.equal(worldsReturnPath("//evil.example"), null);
    assert.equal(worldsReturnPath("https://evil.example/worlds"), null);
    assert.equal(worldsReturnPath("/worlds?next=https://evil.example"), null);
    assert.equal(worldsReturnCookie("mm_worlds_return=/worlds"), "/worlds");
    assert.equal(worldsReturnCookie("other=1; mm_worlds_return=/portal/worlds"), "/worlds");
    assert.equal(worldsReturnCookie("mm_worlds_return=https%3A%2F%2Fevil.example"), null);

    assert.match(source("src/app/worlds/page.tsx"), /requireViewer\("\/worlds"\)/);
    assert.match(source("src/app/login/page.tsx"), /next=\/worlds/);
    assert.match(source("src/app/api/auth/callback/route.ts"), /worldsReturnCookie/);
    assert.match(source("src/app/api/auth/callback/route.ts"), /creatorStartPath/);
    assert.match(source("src/app/api/auth/google/route.ts"), /WORLDS_RETURN_COOKIE/);
    assert.match(source("src/app/actions.ts"), /worldsReturnPath/);
  });

  test("the public updater manifest only republishes a worlds release", () => {
    assert.equal(worldsReleaseVersion("worlds-v0.1.1"), "0.1.1");
    assert.equal(worldsReleaseVersion("worlds-v0.1.1-beta"), null);
    assert.equal(worldsReleaseVersion("v0.1.1"), null);
    assert.equal(compareVersions("0.1.2", "0.1.1") > 0, true);
    assert.equal(compareVersions("0.1.10", "0.1.9") > 0, true);
    const chosen = newestWorldsRelease([
      { tag_name: "worlds-v0.1.1", assets: [] },
      { tag_name: "v9.0.0", assets: [] },
      { tag_name: "worlds-v0.1.2", draft: true, assets: [] },
      { tag_name: "worlds-v0.2.0", prerelease: true, assets: [] },
    ]);
    assert.equal(chosen?.tag_name, "worlds-v0.1.1");
    assert.equal(safeAssetName("../secret"), null);
    assert.equal(safeAssetName("Momma.Mari.Worlds_0.1.1_x64-setup.exe"), "Momma.Mari.Worlds_0.1.1_x64-setup.exe");
    assert.equal(safeAssetName("Momma Mari Worlds_0.1.2_x64-setup.exe"), "Momma Mari Worlds_0.1.2_x64-setup.exe");
    assert.equal(safeAssetName("Momma Mari Worlds_0.1.2_x64-setup.nsis.zip"), "Momma Mari Worlds_0.1.2_x64-setup.nsis.zip");
    const githubUrl = "https://github.com/authentickambiz-boop/momma-mari-creator-portal/releases/download/worlds-v0.1.2/Momma.Mari.Worlds_0.1.2_x64-setup.exe";
    const manifest = rewriteUpdaterManifest({
      version: "0.1.2",
      notes: "Office fix",
      pub_date: "2026-10-23T00:00:00Z",
      platforms: {
        "windows-x86_64": { signature: "sig", url: githubUrl },
        "darwin-aarch64": { signature: "sig2", url: "https://evil.example/not-a-release.exe" },
      },
    });
    assert.equal(manifest?.platforms["windows-x86_64"].url, githubUrl);
    assert.equal(manifest?.platforms["darwin-aarch64"].url, desktopDownloadUrl("not-a-release.exe"));
    assert.equal(manifest?.platforms["windows-x86_64"].signature, "sig");
    const hidden = rewriteUpdaterManifest({
      version: "0.1.2",
      platforms: { "windows-x86_64": { signature: "sig", url: githubUrl } },
    }, { anonymous: false });
    assert.equal(hidden?.platforms["windows-x86_64"].url, desktopDownloadUrl("Momma.Mari.Worlds_0.1.2_x64-setup.exe"));
    assert.equal(rewriteUpdaterManifest({ version: "latest", platforms: {} }), null);
    assert.equal(rewriteUpdaterManifest({
      version: "0.1.2",
      platforms: { "windows-x86_64": { signature: "sig", url: "http://example.com/setup.exe" } },
    }), null);

    const repo = "https://github.com/authentickambiz-boop/momma-mari-creator-portal";
    assert.equal(worldsTagFromGithubLocation(`${repo}/releases/tag/worlds-v0.1.3`), "worlds-v0.1.3");
    assert.equal(worldsTagFromGithubLocation(`${repo}/releases/tag/v0.1.3`), null);
    assert.equal(worldsTagFromGithubLocation("https://evil.example/authentickambiz-boop/momma-mari-creator-portal/releases/tag/worlds-v0.1.3"), null);
    assert.equal(publicLatestJsonUrl("worlds-v0.1.3"), `${repo}/releases/download/worlds-v0.1.3/latest.json`);
    assert.equal(publicLatestJsonUrl("worlds-v0.1.3-beta"), null);
    assert.deepEqual(worldsTagsFromAtom(`
      <entry><link href="${repo}/releases/tag/worlds-v0.1.2"/></entry>
      <entry><link href="${repo}/releases/tag/v9.0.0"/></entry>
      <entry><link href="${repo}/releases/tag/worlds-v0.1.3"/></entry>
    `), ["worlds-v0.1.3", "worlds-v0.1.2"]);
    assert.equal(githubAssetIsPublic(302, false), true);
    assert.equal(githubAssetIsPublic(404, false), false);
    assert.equal(githubAssetIsPublic(403, false), true);
    assert.equal(githubAssetIsPublic(403, true), false);
  });
});
