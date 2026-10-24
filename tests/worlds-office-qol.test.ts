import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import * as THREE from "three";
import {
  BOT_HOVER_RING_OUTER,
  botCapsuleWorldCenter,
  pickBotCapsule,
  rayFromClient,
} from "../src/lib/worlds/bot-hit";
import { nameTagInk } from "../src/lib/worlds/character";
import { officeBootStep } from "../src/lib/worlds/office-boot";
import { buildOfficeLayout } from "../src/lib/worlds/office-layout";
import { OFFICE_FOV, officeCameraHome } from "../src/lib/worlds/office-move";
import { presentedBotYaw } from "../src/lib/worlds/office-sim";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("office QOL", () => {
  test("a neighbor closer to the camera does not steal the bot under the pointer", () => {
    const view = { left: 0, top: 0, width: 1024, height: 768 };
    const camera = new THREE.PerspectiveCamera(OFFICE_FOV, view.width / view.height, 0.1, 800);
    camera.position.set(0, 18, 40);
    camera.lookAt(0, 1.6, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const aimed = { id: "content", x: 0, y: 0, z: 0, yaw: 0 };
    const neighbor = { id: "kash", x: 1.5, y: 0, z: 0.8, yaw: 0 };
    const world = botCapsuleWorldCenter(aimed);
    const ndc = world.clone().project(camera);
    const clientX = ((ndc.x + 1) / 2) * view.width;
    const clientY = ((-ndc.y + 1) / 2) * view.height;
    const ray = rayFromClient(camera, clientX, clientY, view);
    assert.ok(ray);
    assert.equal(pickBotCapsule(ray, [neighbor, aimed]), "content");
    const nudged = rayFromClient(camera, clientX + 16, clientY, view);
    assert.ok(nudged);
    assert.equal(pickBotCapsule(nudged, [neighbor, aimed]), "content");
  });

  test("each default-view desk center highlights that bot, and the ring stays on one desk", () => {
    const layout = buildOfficeLayout();
    const home = officeCameraHome(layout.width, layout.depth);
    const view = { left: 0, top: 0, width: 1280, height: 800 };
    const camera = new THREE.PerspectiveCamera(OFFICE_FOV, view.width / view.height, 0.1, 800);
    camera.position.copy(home.position);
    camera.lookAt(home.target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const cameraFlat = { x: camera.position.x, z: camera.position.z };
    const poses = Object.entries(layout.homes).map(([id, spot]) => ({
      id,
      x: spot.x,
      y: 0,
      z: spot.z,
      yaw: presentedBotYaw({ x: spot.x, z: spot.z, yaw: 0, path: [] }, cameraFlat),
    }));
    let nearest = Infinity;
    const ids = Object.keys(layout.homes);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = layout.homes[ids[i]];
        const b = layout.homes[ids[j]];
        if (!a || !b) continue;
        nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.z - b.z));
      }
    }
    assert.ok(BOT_HOVER_RING_OUTER * 2 < nearest, `ring ${BOT_HOVER_RING_OUTER} reaches a desk ${nearest.toFixed(2)} away`);
    for (const pose of poses) {
      const world = botCapsuleWorldCenter(pose);
      const ndc = world.clone().project(camera);
      assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, pose.id);
      const ray = rayFromClient(
        camera,
        ((ndc.x + 1) / 2) * view.width,
        ((-ndc.y + 1) / 2) * view.height,
        view,
      );
      assert.equal(pickBotCapsule(ray!, poses), pose.id, pose.id);
    }
  });

  test("idle bots face the camera and a walking bot keeps its step", () => {
    const idle = presentedBotYaw({ x: 2, z: 4, yaw: Math.PI, path: [] }, { x: 10, z: 20 });
    assert.ok(idle > 0 && idle < Math.PI / 2);
    assert.equal(presentedBotYaw({ x: 2, z: 4, yaw: 1.2, path: [{ x: 3, z: 4 }] }, { x: 10, z: 20 }), 1.2);
  });

  test("the boot climbs to done and name ink stays readable", () => {
    const plan = officeBootStep("plan").progress;
    const shell = officeBootStep("shell").progress;
    const bots = officeBootStep("bots").progress;
    const detail = officeBootStep("detail");
    assert.ok(plan < shell && shell < bots && bots < detail.progress);
    assert.equal(detail.progress, 100);
    assert.equal(detail.label.length > 0, true);
    assert.equal(nameTagInk("#f2c14e"), "#1c211e");
    assert.equal(nameTagInk("#1c211e"), "#fbf8f3");
    assert.equal(nameTagInk("nope"), "#1c211e");
  });

  test("load, panels, hover, and name tags are wired without payments", () => {
    const app = source("src/components/worlds/office-app.tsx");
    const canvas = source("src/components/worlds/office-canvas.tsx");
    const css = source("src/components/worlds/office.css");
    const grounds = source("src/components/worlds/office-grounds.tsx");
    assert.match(app, /OfficeBoot/);
    assert.match(app, /useState<OfficeSheet \| null>/);
    assert.match(app, /aria-label="Close"/);
    assert.match(app, /onClear=\{dismiss\}/);
    assert.match(app, /mm-worlds-panels/);
    assert.match(canvas, /SceneryTap/);
    assert.match(canvas, /onPointerMissed/);
    assert.match(canvas, /flatOfficeMaterials/);
    assert.match(canvas, /office-name-tag/);
    assert.match(canvas, /BOT_HOVER_RING_OUTER/);
    assert.match(canvas, /presentedBotYaw/);
    assert.match(canvas, /Opening the bot office/);
    assert.match(canvas, /LEFT: -1 as THREE\.MOUSE/);
    assert.match(canvas, /wheelZoomFactor/);
    assert.equal(canvas.includes("offset.setLength"), false);
    assert.match(css, /office-skeleton/);
    assert.match(css, /office-boot-bar/);
    assert.match(css, /max-height: 45vh/);
    assert.match(css, /font: 700 15px/);
    assert.match(grounds, /if \(!detailed\)/);
    assert.equal(app.includes("api.stripe.com"), false);
    assert.equal(canvas.includes("api.stripe.com"), false);
  });
});
