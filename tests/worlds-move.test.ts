import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { OfficeJoystick } from "../src/components/worlds/office-joystick";
import { buildOfficeLayout } from "../src/lib/worlds/office-layout";
import {
  MAP_MIN_DISTANCE,
  OFFICE_FOV,
  PAN_DRAG_PX,
  STICK_SPEED,
  grabPanDelta,
  moveDelta,
  officeCameraHome,
  officeCameraPoseOk,
  rayGroundPoint,
  roofBlocksClicks,
  roofOpenAmount,
  rotateOffset,
  stickFromDrag,
  wheelZoomFactor,
  zoomOffset,
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
    assert.match(down, /aria-label="Move"/);
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
    assert.ok(app.indexOf("<WorldsHud") > 0 && app.indexOf("<OfficeJoystick") > app.indexOf("<WorldsHud"));
    assert.match(stick, /aria-label=\{label\}/);
    assert.match(stick, /label = "Move"/);
    assert.match(stick, /setPointerCapture/);
    assert.match(stick, /stopPropagation/);
    assert.match(stick, /stickRef\.current = \{ x: 0, y: 0 \}/);
    assert.match(css, /\.office-joystick \{[^}]*display: none/);
    assert.match(css, /@media \(pointer: coarse\), \(max-width: 800px\) \{\s*\.office-joystick \{ display: block; \}/);
    assert.match(css, /\.office-joystick\.is-lifted \{[^}]*safe-area-inset-left/);
    assert.match(css, /data-dragging="true"/);
    assert.match(canvas, /grabPanDelta/);
    assert.match(canvas, /rayGroundPoint/);
    assert.match(canvas, /moveDelta/);
    assert.match(canvas, /PAN_DRAG_PX/);
    assert.match(canvas, /LEFT: -1 as THREE\.MOUSE/);
    assert.match(canvas, /RIGHT: -1 as THREE\.MOUSE/);
    assert.match(canvas, /rotateOffset/);
    assert.match(canvas, /wheelZoomFactor/);
    assert.match(canvas, /zoomOffset\(aim/);
    assert.match(canvas, /applyDistanceZoom\(orbit, home\.aim/);
    assert.equal(canvas.includes("offset.setLength"), false);
    assert.match(canvas, /stopImmediatePropagation/);
    assert.match(canvas, /THREE\.TOUCH\.DOLLY_ROTATE/);
    assert.match(canvas, /THREE\.TOUCH\.PAN/);
    assert.match(canvas, /pointerType === "touch"/);
    assert.match(canvas, /if \(!gesture\.current\.dragged\) onClear\(\)/);
  });

  test("the default camera frames the whole building and a failed view is visible", () => {
    const layout = buildOfficeLayout();
    const home = officeCameraHome(layout.width, layout.depth);
    assert.ok(home.distance > 40 && home.distance < 160);
    assert.ok(home.position.y > 8);
    const camera = new THREE.PerspectiveCamera(OFFICE_FOV, 4 / 3, 0.1, 800);
    camera.position.copy(home.position);
    camera.lookAt(home.target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    for (const y of [0, 3.2]) {
      for (const x of [0, layout.width]) {
        for (const z of [0, layout.depth]) {
          const ndc = new THREE.Vector3(x, y, z).project(camera);
          assert.ok(ndc.z > -1 && ndc.z < 1, `${x},${y},${z} z ${ndc.z}`);
          assert.ok(Math.abs(ndc.x) < 0.92 && Math.abs(ndc.y) < 0.92, `${x},${y},${z} ${ndc.x},${ndc.y}`);
        }
      }
    }
    const wide = new THREE.PerspectiveCamera(OFFICE_FOV, 16 / 9, 0.1, 800);
    wide.position.copy(home.position);
    wide.lookAt(home.target);
    wide.updateMatrixWorld();
    wide.updateProjectionMatrix();
    for (const x of [0, layout.width]) {
      for (const z of [0, layout.depth]) {
        const ndc = new THREE.Vector3(x, 1.5, z).project(wide);
        assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1);
      }
    }
    const canvas = source("src/components/worlds/office-canvas.tsx");
    const css = source("src/components/worlds/office.css");
    assert.match(canvas, /powerPreference: "default"/);
    assert.match(canvas, /alpha: false/);
    assert.match(canvas, /The 3D office did not draw/);
    assert.match(canvas, /webglcontextlost/);
    assert.equal(canvas.includes('powerPreference: "high-performance"'), false);
    assert.match(css, /\.office-notice/);
    const stick = canvas.slice(canvas.indexOf("function StickMover"), canvas.indexOf("function CameraGuard"));
    assert.match(stick, /useFrame\(\(_, dt\) => \{/);
    assert.equal(stick.includes(", 1)"), false);
    assert.match(canvas, /function CameraGuard/);
    assert.match(canvas, /officeCameraPoseOk/);
    const homeOk = officeCameraPoseOk(home.position, home.target, layout);
    assert.equal(homeOk, true);
    assert.equal(officeCameraPoseOk(
      { x: Number.NaN, y: 20, z: 40 },
      { x: home.target.x, y: home.target.y, z: home.target.z },
      layout,
    ), false);
    assert.equal(officeCameraPoseOk(
      { x: 10, y: -4, z: 10 },
      { x: home.target.x, y: home.target.y, z: home.target.z },
      layout,
    ), false);
    assert.equal(officeCameraPoseOk(
      home.position,
      { x: layout.width + 80, y: 1.4, z: layout.depth / 2 },
      layout,
    ), false);
  });

  test("wheel zoom reaches the roof in about twelve notches and clicks pass through it", () => {
    assert.equal(wheelZoomFactor(0), 1);
    assert.equal(wheelZoomFactor(Number.NaN), 1);
    assert.ok(Math.abs(wheelZoomFactor(-100) - 0.9) < 1e-9);
    assert.ok(Math.abs(wheelZoomFactor(100) - (1 / 0.9)) < 1e-9);
    assert.ok(wheelZoomFactor(-10) > 0.97);
    assert.ok(Math.abs(wheelZoomFactor(-10000) - (0.9 ** 6)) < 1e-9);
    let distance = 71;
    for (let step = 0; step < 12; step += 1) distance *= wheelZoomFactor(-100);
    assert.ok(distance > 18 && distance < 22, `distance ${distance}`);

    const layoutForZoom = buildOfficeLayout();
    const homeForZoom = officeCameraHome(layoutForZoom.width, layoutForZoom.depth);
    const aim = homeForZoom.position.clone().sub(homeForZoom.target);
    const homeSpherical = new THREE.Spherical().setFromVector3(aim);
    for (const factor of [wheelZoomFactor(100), wheelZoomFactor(-100)]) {
      const zoomed = zoomOffset(aim, homeForZoom.distance, factor);
      const spherical = new THREE.Spherical().setFromVector3(new THREE.Vector3(zoomed.x, zoomed.y, zoomed.z));
      assert.ok(Math.abs(spherical.theta - homeSpherical.theta) < 1e-6, `theta ${spherical.theta}`);
      assert.ok(Math.abs(spherical.phi - homeSpherical.phi) < 1e-6, `phi ${spherical.phi}`);
      assert.ok(Math.abs(zoomed.distance - homeForZoom.distance * factor) < 1e-6);
    }
    const closest = zoomOffset(aim, homeForZoom.distance, 0);
    assert.equal(closest.distance, MAP_MIN_DISTANCE);
    const framed = 2 * MAP_MIN_DISTANCE * Math.tan(THREE.MathUtils.degToRad(OFFICE_FOV / 2));
    assert.ok(framed < 1, `a character should fill the close view, framed height ${framed}`);
    const closePosition = homeForZoom.target.clone().add(new THREE.Vector3(closest.x, closest.y, closest.z));
    assert.equal(officeCameraPoseOk(closePosition, homeForZoom.target, layoutForZoom), true);

    const layout = buildOfficeLayout();
    const home = officeCameraHome(layout.width, layout.depth);
    const far = roofOpenAmount(home.position, layout);
    assert.ok(far < 0.05, `overview ${far}`);
    assert.equal(roofBlocksClicks(far), true);
    const inside = roofOpenAmount({ x: layout.width / 2, y: 4, z: layout.depth / 2 }, layout);
    assert.ok(inside > 0.9, `inside ${inside}`);
    assert.equal(roofBlocksClicks(0.35), true);
    assert.equal(roofBlocksClicks(inside), false);
    const approaching = roofOpenAmount({ x: layout.width / 2, y: 18, z: layout.depth + 12 }, layout);
    assert.ok(approaching > 0.05 && approaching < 0.95, `approach ${approaching}`);

    const right = rotateOffset(80, 0, 800);
    assert.ok(right.theta < 0);
    assert.equal(right.phi, 0);
    assert.ok(rotateOffset(0, 40, 800).phi < 0);
    assert.equal(rotateOffset(0, 0, 800).theta, 0);

    const grounds = source("src/components/worlds/office-grounds.tsx");
    assert.match(grounds, /roofOpenAmount/);
    assert.match(grounds, /roofBlocksClicks/);
    assert.match(grounds, /skipRoofRaycast/);
    const canvas = source("src/components/worlds/office-canvas.tsx");
    assert.match(canvas, /frameloop="always"/);
    assert.match(canvas, /role="status"/);
    assert.match(canvas, /Opening the bot office/);
    assert.match(canvas, /function FirstPaint/);
    assert.match(canvas, /gl\.render\(scene, view\)/);
    assert.match(source("src/app/layout.tsx"), /withBasePath\("\/icon-192\.png"\)/);
    assert.match(source("src/components/worlds/office.css"), /\.office-loading \{[^}]*background: #1b1714/);
  });
});
