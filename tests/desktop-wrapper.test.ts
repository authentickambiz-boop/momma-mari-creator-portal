import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Momma Mari Worlds desktop", () => {
  test("the Tauri window opens the live office, remembers its place, and sends grokbot links out", () => {
    const main = source("desktop/src-tauri/src/main.rs");
    const config = source("desktop/src-tauri/tauri.conf.json");
    const workflow = source(".github/workflows/desktop.yml");
    const readme = source("README.md");

    assert.match(main, /https:\/\/mommamari\.com\/worlds/);
    assert.match(main, /grokbot/);
    assert.match(main, /open::that/);
    assert.match(main, /StateFlags::POSITION/);
    assert.match(main, /StateFlags::SIZE/);
    assert.match(main, /Toggle Fullscreen/);
    assert.match(main, /F11/);
    assert.match(main, /Momma Mari Worlds/);
    assert.match(config, /"productName": "Momma Mari Worlds"/);
    assert.match(config, /"identifier": "com\.mommamari\.worlds"/);
    assert.match(config, /nsis/);
    assert.match(config, /dmg/);
    assert.equal(config.includes("withGlobalTauri\": true"), false);

    for (const icon of ["32x32.png", "128x128.png", "128x128@2x.png", "icon.icns", "icon.ico"]) {
      assert.equal(existsSync(path.join("desktop/src-tauri/icons", icon)), true, icon);
    }

    assert.match(workflow, /windows-latest/);
    assert.match(workflow, /macos-latest/);
    assert.match(workflow, /upload-artifact/);
    assert.match(workflow, /--bundles nsis/);
    assert.match(workflow, /--bundles dmg/);
    assert.match(workflow, /action-gh-release/);

    assert.match(readme, /Pin to taskbar/);
    assert.match(readme, /Keep in Dock/);
    assert.match(readme, /momma-mari-worlds-windows-latest/);
    assert.match(readme, /momma-mari-worlds-macos-latest/);
    assert.match(readme, /grokbot:\/\//);
  });
});
