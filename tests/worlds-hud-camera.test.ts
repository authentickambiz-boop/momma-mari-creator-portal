import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorldsHud } from "../src/components/worlds/worlds-hud";
import {
  FOLLOW_DEFAULT_DISTANCE,
  FOLLOW_LOOK_Y,
  FOLLOW_MIN_DISTANCE,
  desiredFollowPose,
  followOrbitBehind,
  orbitFollow,
  smoothFollowValue,
  worldsCityEnabled,
  zoomFollowDistance,
} from "../src/lib/worlds/follow-camera";
import { buildOfficeLayout, OWNER_ACTOR_ID } from "../src/lib/worlds/office-layout";
import { isBotOfficePath, isWorldsCityPath } from "../src/lib/worlds/office-path";
import { worldsReturnPath } from "../src/lib/worlds/office-return";
import { createSimState, placeOwnerOutdoors, stepOwner } from "../src/lib/worlds/office-sim";
import { nextUpLine } from "../src/lib/worlds/worlds-hud";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Worlds HUD and follow camera", () => {
  test("the follow camera stays centered on the character and zoom only changes distance", () => {
    const orbit = followOrbitBehind(0);
    const pose = desiredFollowPose({ x: 10, z: 4 }, orbit);
    assert.equal(pose.target.x, 10);
    assert.equal(pose.target.y, FOLLOW_LOOK_Y);
    assert.equal(pose.target.z, 4);
    assert.ok(pose.position.z < pose.target.z);
    assert.ok(pose.position.y > FOLLOW_LOOK_Y);
    assert.equal(pose.distance, FOLLOW_DEFAULT_DISTANCE);
    const closer = zoomFollowDistance(pose.distance, 0.5);
    assert.ok(closer < pose.distance);
    assert.equal(zoomFollowDistance(pose.distance, 0), FOLLOW_MIN_DISTANCE);
    const turned = orbitFollow(orbit, 40, 0, 800);
    assert.notEqual(turned.yaw, orbit.yaw);
    assert.equal(turned.distance, orbit.distance);
    assert.equal(turned.pitch, orbit.pitch);
    const stepped = smoothFollowValue(0, 10, 0.05);
    assert.ok(stepped > 0 && stepped < 10);
  });

  test("the city flag is off unless it is explicitly on, and both places share the office path", () => {
    assert.equal(worldsCityEnabled(undefined), false);
    assert.equal(worldsCityEnabled(""), false);
    assert.equal(worldsCityEnabled("false"), false);
    assert.equal(worldsCityEnabled("true"), true);
    assert.equal(worldsCityEnabled("on"), true);
    assert.equal(worldsCityEnabled("1"), true);
    assert.equal(isBotOfficePath("/worlds"), true);
    assert.equal(isBotOfficePath("/worlds/city"), true);
    assert.equal(isBotOfficePath("/portal/worlds/city", "/portal"), true);
    assert.equal(isBotOfficePath("/worlds/extra"), false);
    assert.equal(isWorldsCityPath("/worlds/city"), true);
    assert.equal(isWorldsCityPath("/worlds"), false);
    assert.equal(worldsReturnPath("/portal/worlds/city"), "/worlds/city");
    assert.equal(worldsReturnPath("/worlds/city?x=1"), null);
  });

  test("the owner walks inside the grounds and the city spawn faces the building", () => {
    const layout = buildOfficeLayout();
    const state = createSimState(layout, [OWNER_ACTOR_ID]);
    const bot = state.bots[OWNER_ACTOR_ID];
    assert.ok(bot);
    if (!bot) return;
    assert.equal(stepOwner(bot, layout, { x: 0, z: 0 }), false);
    assert.equal(stepOwner(bot, layout, { x: 3, z: 0 }), true);
    assert.ok(bot.x > layout.homes[OWNER_ACTOR_ID].x);
    assert.equal(bot.act, "Walking");
    bot.x = layout.width + 100;
    stepOwner(bot, layout, { x: 50, z: 0 });
    assert.ok(bot.x <= layout.width + 8);
    placeOwnerOutdoors(state, layout);
    assert.equal(bot.z, layout.depth + 8);
    assert.equal(bot.yaw, Math.PI);
    const behind = desiredFollowPose({ x: bot.x, z: bot.z }, followOrbitBehind(bot.yaw));
    assert.ok(behind.position.z > bot.z);
    assert.equal(behind.target.x, bot.x);
    assert.equal(behind.target.z, bot.z);
  });

  test("the quest line and the rail render the same edge HUD for every width", () => {
    assert.equal(nextUpLine({ todos: [{ task: "Open the shop", done: false }], charactersEnabled: false, place: "office" }), "Open the shop");
    assert.equal(nextUpLine({ todos: [{ task: "Done", done: true }], charactersEnabled: true, place: "office" }), "Customize your character");
    assert.equal(nextUpLine({ todos: [], charactersEnabled: false, place: "city" }), "Walk the block");
    const html = renderToStaticMarkup(createElement(WorldsHud, {
      walletText: "26",
      bankText: "0",
      onWallet: () => undefined,
      onBank: () => undefined,
      quest: "Open the shop",
      onQuest: () => undefined,
      inventoryLocked: true,
      active: "shop",
      onOpen: () => undefined,
    }));
    assert.match(html, /NEXT UP!/);
    assert.match(html, /Open the shop/);
    assert.match(html, /Kash/);
    assert.match(html, /₭/);
    assert.equal(html.includes(">$<"), false);
    assert.match(html, /Bank/);
    assert.match(html, /aria-label="Places"/);
    assert.match(html, /aria-label="Shop"/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /aria-label="Tasks"/);
    assert.match(html, /aria-label="Settings"/);
    assert.match(html, /aria-label="Inventory, locked"/);
    assert.match(html, /worlds-lock/);
    assert.match(html, /worlds-rail-glyph/);
    assert.match(html, /worlds-rail/);
    assert.match(html, /worlds-quest/);
    const app = source("src/components/worlds/office-app.tsx");
    const page = source("src/app/worlds/page.tsx");
    const city = source("src/app/worlds/city/page.tsx");
    assert.match(app, /data-camera-mode=/);
    assert.match(app, /place === "city" \? "follow" : cameraMode/);
    assert.match(page, /place="office"/);
    assert.match(city, /place="city"/);
    assert.match(city, /worldsCityEnabled\(\)/);
    assert.match(city, /notFound\(\)/);
    assert.match(source("src/components/worlds/office-canvas.tsx"), /followOrbitBehind\(bot\?\.yaw \?\? 0\)/);
    assert.match(source("src/components/worlds/office.css"), /@media \(max-width: 800px\)/);
    assert.match(source("src/components/worlds/office.css"), /@media \(min-width: 801px\)/);
    assert.equal(source("src/components/worlds/office-app.tsx").includes("api.stripe.com"), false);
  });
});