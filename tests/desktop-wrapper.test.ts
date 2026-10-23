import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { worldsReturnCookie, worldsReturnPath } from "../src/lib/worlds/office-return";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Momma Mari Worlds desktop", () => {
  test("the Tauri window opens the live office, remembers its place, and sends grokbot links out", () => {
    const main = source("desktop/src-tauri/src/main.rs");
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
    assert.match(config, /"version": "0\.1\.1"/);
    assert.match(source("desktop/package.json"), /"version": "0\.1\.1"/);
    assert.match(source("desktop/src-tauri/Cargo.toml"), /version = "0\.1\.1"/);
    assert.match(config, /"productName": "Momma Mari Worlds"/);
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

    assert.match(readme, /www\.mommamari\.com\/portal\/worlds/);
    assert.match(readme, /Pin to taskbar/);
    assert.match(readme, /Keep in Dock/);
    assert.match(readme, /momma-mari-worlds-windows-latest/);
    assert.match(readme, /momma-mari-worlds-macos-latest/);
    assert.match(readme, /grokbot:\/\//);
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
});
