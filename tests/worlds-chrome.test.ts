import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { PANELS_STORAGE_KEY, panelsEnabledFromStorage, panelsStorageValue } from "../src/lib/worlds/office-chrome";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Worlds office chrome", () => {
  test("panels stay on unless this browser saved off", () => {
    assert.equal(PANELS_STORAGE_KEY, "mm-worlds-panels");
    assert.equal(panelsEnabledFromStorage(null), true);
    assert.equal(panelsEnabledFromStorage(undefined), true);
    assert.equal(panelsEnabledFromStorage("on"), true);
    assert.equal(panelsEnabledFromStorage("show"), true);
    assert.equal(panelsEnabledFromStorage("hide"), true);
    assert.equal(panelsEnabledFromStorage("off"), false);
    assert.equal(panelsStorageValue(true), "on");
    assert.equal(panelsStorageValue(false), "off");
  });

  test("the edge HUD opens one centered panel and keeps the map tools in settings", () => {
    const app = source("src/components/worlds/office-app.tsx");
    const hud = source("src/components/worlds/worlds-hud.tsx");
    const css = source("src/components/worlds/office.css");
    const canvas = source("src/components/worlds/office-canvas.tsx");
    const hudAt = app.indexOf("<WorldsHud");
    const findAt = app.indexOf('aria-label="Find a bot"');
    const zoomAt = app.indexOf('aria-label="Zoom in"');
    const mapAt = app.indexOf('aria-label="Office map"');
    assert.ok(hudAt > 0 && findAt > hudAt && zoomAt > hudAt && mapAt > hudAt);
    assert.match(hud, /aria-label=\{locked \? `\$\{item\.label\}, locked` : item\.label\}/);
    assert.match(hud, /NEXT UP!/);
    assert.match(app, /worlds-backdrop/);
    assert.match(app, /event\.key !== "Escape"/);
    assert.match(app, /aria-label="Close"/);
    assert.match(app, /onClear=\{dismiss\}/);
    assert.match(app, /if \(!panelsEnabled\) return/);
    assert.match(app, /mm-worlds-panels/);
    assert.match(app, /localStorage/);
    assert.match(css, /worlds-rail/);
    assert.match(css, /worlds-quest/);
    assert.match(css, /max-height: min\(78vh, 680px\)/);
    assert.match(canvas, /grabPanDelta/);
    assert.match(canvas, /RIGHT: -1 as THREE\.MOUSE/);
    assert.match(canvas, /rotateOffset/);
    assert.match(canvas, /THREE\.TOUCH\.PAN/);
    assert.match(canvas, /THREE\.TOUCH\.DOLLY_ROTATE/);
    assert.match(canvas, /zoomBy/);
    assert.match(canvas, /reset\(\)/);
    assert.match(canvas, /FollowRig/);
    assert.match(canvas, /desiredFollowPose/);
  });
});
