import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OfficeJoystick } from "../src/components/worlds/office-joystick";
import {
  PAN_DRAG_PX,
  STICK_SPEED,
  grabPanDelta,
  moveDelta,
  rayGroundPoint,
  stickFromDrag,
} from "../src/lib/worlds/office-move";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Worlds camera move", () => {
  test("the joystick is a round control and lifts while a sheet is open", () => {
    const stickRef = { current: { x: 0, y: 0 } };
    const down = renderToStaticMarkup(createElement(OfficeJoystick, { stickRef, lifted: false }));
    assert.match(down, /class="office-joystick"/);
    assert.equal(down.includes("is-lifted"), false);
    assert.match(down, /aria-label="Move the camera"/);
    assert.match(down, /office-joystick-base/);
    assert.match(down, /office-joystick-knob/);
    const up = renderToStaticMarkup(createElement(OfficeJoystick, { stickRef, lifted: true }));
    assert.match(up, /class="office-joystick is-lifted"/);
  });

  test("the stick springs from the drag and clamps at the rim", () => {
    assert.deepEqual(stickFromDrag(0, 0, 28), { x: 0, y: 0 });
    assert.deepEqual(stickFromDrag(0, -28, 28), { x: 0, y: 1 });
    assert.deepEqual(stickFromDrag(28, 0, 28), { x: 1, y: 0 });
    const half = stickFromDrag(14, 0, 28);
    assert.ok(Math.abs(half.x - 0.5) < 1e-9);
    assert.equal(half.y, 0);
    const past = stickFromDrag(0, -80, 28);
    assert.deepEqual(past, { x: 0, y: 1 });
    const diagonal = stickFromDrag(40, 40, 28);
    assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
    assert.ok(diagonal.x > 0 && diagonal.y < 0);
    assert.deepEqual(stickFromDrag(4, 4, 0), { x: 0, y: 0 });
  });

  test("movement follows the camera heading and the push distance", () => {
    const forward = moveDelta({ x: 0, y: 1 }, 0, 10, 1);
    assert.ok(forward.z < 0);
    assert.ok(Math.abs(forward.x) < 1e-9);
    assert.ok(Math.abs(forward.z + STICK_SPEED) < 1e-9);
    const right = moveDelta({ x: 1, y: 0 }, 0, 10, 1);
    assert.ok(right.x > 0);
    assert.ok(Math.abs(right.z) < 1e-9);

    const turned = moveDelta({ x: 0, y: 1 }, 10, 0, 1);
    assert.ok(turned.x < 0);
    assert.ok(Math.abs(turned.z) < 1e-9);
    const turnedRight = moveDelta({ x: 1, y: 0 }, 10, 0, 1);
    assert.ok(turnedRight.z < 0);
    assert.ok(Math.abs(turnedRight.x) < 1e-9);

    const half = moveDelta({ x: 0, y: 0.5 }, 0, 10, 1);
    assert.ok(Math.abs(half.z - forward.z * 0.5) < 1e-9);
    const brief = moveDelta({ x: 0, y: 1 }, 0, 10, 0.25);
    assert.ok(Math.abs(brief.z - forward.z * 0.25) < 1e-9);
    assert.deepEqual(moveDelta({ x: 0, y: 0 }, 0, 10, 1), { x: 0, z: 0 });
  });

  test("a ground grab keeps the picked point under the pointer", () => {
    assert.deepEqual(grabPanDelta({ x: 5, z: 5 }, { x: 6, z: 4 }), { x: -1, z: 1 });
    assert.deepEqual(grabPanDelta({ x: 1, z: 2 }, { x: 1, z: 2 }), { x: 0, z: 0 });
    const down = rayGroundPoint({ x: 2, y: 10, z: 3 }, { x: 0, y: -1, z: 0 }, 0);
    assert.deepEqual(down, { x: 2, z: 3 });
    const slant = rayGroundPoint({ x: 0, y: 10, z: 0 }, { x: 1, y: -2, z: 0 }, 0);
    assert.deepEqual(slant, { x: 5, z: 0 });
    assert.equal(rayGroundPoint({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 0), null);
    assert.equal(rayGroundPoint({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 0), null);
    assert.equal(PAN_DRAG_PX, 10);
  });

  test("the joystick is the phone control and desktop left-drag grabs the ground", () => {
    const app = source("src/components/worlds/office-app.tsx");
    const css = source("src/components/worlds/office.css");
    const canvas = source("src/components/worlds/office-canvas.tsx");
    const stick = source("src/components/worlds/office-joystick.tsx");
    assert.match(app, /<OfficeJoystick/);
    assert.match(app, /lifted=\{sheet !== null\}/);
    assert.equal(app.includes("menuOpen ?") && app.indexOf("<OfficeJoystick") > app.indexOf("menuOpen ?"), true);
    assert.match(stick, /aria-label="Move the camera"/);
    assert.match(stick, /setPointerCapture/);
    assert.match(stick, /stopPropagation/);
    assert.match(stick, /stickRef\.current = \{ x: 0, y: 0 \}/);
    assert.match(css, /\.office-joystick \{[^}]*display: none/);
    assert.match(css, /@media \(pointer: coarse\) \{\s*\.office-joystick \{ display: block; \}/);
    assert.match(css, /\.office-joystick\.is-lifted \{[^}]*45vh/);
    assert.match(css, /data-dragging="true"/);
    assert.match(canvas, /grabPanDelta/);
    assert.match(canvas, /rayGroundPoint/);
    assert.match(canvas, /moveDelta/);
    assert.match(canvas, /PAN_DRAG_PX/);
    assert.match(canvas, /LEFT: -1 as THREE\.MOUSE/);
    assert.match(canvas, /RIGHT: THREE\.MOUSE\.ROTATE/);
    assert.match(canvas, /THREE\.TOUCH\.DOLLY_ROTATE/);
    assert.match(canvas, /THREE\.TOUCH\.PAN/);
    assert.match(canvas, /pointerType === "touch"/);
    assert.match(canvas, /if \(!gesture\.current\.dragged\) onClear\(\)/);
  });
});
