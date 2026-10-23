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

  test("search, layers, zoom, and the minimap sit behind one corner menu", () => {
    const app = source("src/components/worlds/office-app.tsx");
    const css = source("src/components/worlds/office.css");
    const canvas = source("src/components/worlds/office-canvas.tsx");
    const menuAt = app.indexOf("menuOpen ?");
    const findAt = app.indexOf('aria-label="Find a bot"');
    const zoomAt = app.indexOf('aria-label="Zoom in"');
    const mapAt = app.indexOf('aria-label="Office map"');
    assert.equal(app.includes("office-corner-button"), true);
    assert.ok(menuAt > 0 && findAt > menuAt && zoomAt > menuAt && mapAt > menuAt);
    assert.match(app, /aria-label="Office tools"/);
    assert.match(app, /aria-expanded=\{menuOpen\}/);
    assert.match(app, /event\.key !== "Escape"/);
    assert.match(app, /aria-label="Close"/);
    assert.match(app, /onClear=\{dismiss\}/);
    assert.match(app, /if \(!panelsEnabled\) return/);
    assert.match(app, /mm-worlds-panels/);
    assert.match(app, /localStorage/);
    assert.match(css, /office-corner/);
    assert.match(css, /max-height: 45vh/);
    assert.match(canvas, /THREE\.MOUSE\.PAN/);
    assert.match(canvas, /THREE\.MOUSE\.ROTATE/);
    assert.match(canvas, /THREE\.TOUCH\.PAN/);
    assert.match(canvas, /THREE\.TOUCH\.DOLLY_ROTATE/);
    assert.match(canvas, /zoomBy/);
    assert.match(canvas, /reset\(\)/);
  });
});
