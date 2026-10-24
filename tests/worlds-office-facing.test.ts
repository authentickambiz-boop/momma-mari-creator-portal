import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { OWNER_LOOK_SEED, defaultCharacter } from "../src/lib/worlds/character";
import { OWNER_ACTOR_ID, buildOfficeLayout, roomAt } from "../src/lib/worlds/office-layout";
import { officeCameraHome } from "../src/lib/worlds/office-move";
import { DESK_SIDE, SEAT_YAW, createSimState, deskFacing, stepOfficeSim, yawToward } from "../src/lib/worlds/office-sim";
import { seedOfficeRecord } from "../src/lib/worlds/office-state";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("desk bots face the default camera", () => {
  test("the home camera sits south of the building, on +Z", () => {
    const layout = buildOfficeLayout();
    const home = officeCameraHome(layout.width, layout.depth);
    assert.ok(home.position.z > home.target.z);
  });

  test("each seat faces the default camera and the monitor stays off that line", () => {
    const layout = buildOfficeLayout();
    const camera = officeCameraHome(layout.width, layout.depth);
    const cam = { x: camera.position.x, z: camera.position.z };
    assert.equal(DESK_SIDE, -1);
    assert.equal(SEAT_YAW, 0);
    for (const [id, spot] of Object.entries(layout.homes)) {
      const yaw = yawToward(spot, cam);
      const forwardX = Math.sin(yaw);
      const forwardZ = Math.cos(yaw);
      const towardX = cam.x - spot.x;
      const towardZ = cam.z - spot.z;
      assert.ok(forwardX * towardX + forwardZ * towardZ > 0, id);
      const facing = deskFacing(spot.x, spot.z);
      const seatDist = (spot.x - cam.x) ** 2 + (spot.z - cam.z) ** 2;
      const monitorDist = (facing.monitor.x - cam.x) ** 2 + (facing.monitor.z - cam.z) ** 2;
      assert.ok(monitorDist > seatDist, id);
      const sx = spot.x - cam.x;
      const sz = spot.z - cam.z;
      const mx = facing.monitor.x - cam.x;
      const mz = facing.monitor.z - cam.z;
      assert.ok(Math.abs(sx * mz - sz * mx) > 0.15, id);
    }
    assert.match(source("src/components/worlds/office-canvas.tsx"), /deskFacing/);
    assert.match(source("src/components/worlds/office-canvas.tsx"), /yawToward/);
    assert.match(source("src/components/worlds/office-canvas.tsx"), /camera\.position/);
    assert.match(source("src/components/worlds/office-canvas.tsx"), /office-you-tag">You</);
  });

  test("new bots start facing the camera, turn to their seat, and face the way they walk", () => {
    const layout = buildOfficeLayout();
    const seated = createSimState(layout, ["life"]);
    const life = seated.bots.life;
    assert.ok(life);
    assert.equal(life.yaw, SEAT_YAW);
    life.yaw = Math.PI;
    for (let i = 0; i < 30; i += 1) {
      stepOfficeSim(seated, layout, 0.08, { meeting: [], statuses: { life: "idle" }, rng: () => 0 });
    }
    assert.ok(Math.abs(life.yaw) < 0.15);

    const walking = createSimState(layout, ["life"]);
    const mover = walking.bots.life;
    assert.ok(mover);
    const home = layout.homes.life;
    assert.ok(home);
    mover.x = home.x;
    mover.z = home.z;
    mover.yaw = SEAT_YAW;
    mover.path = [{ x: home.x, z: home.z - 5 }];
    stepOfficeSim(walking, layout, 0.08, { meeting: [], statuses: { life: "idle" }, rng: () => 0 });
    assert.ok(Math.abs(mover.yaw) > 1);
  });
});

describe("the owner's character sits at HQ", () => {
  test("the owner has an HQ desk and is not a roster bot", () => {
    const layout = buildOfficeLayout();
    const home = layout.homes[OWNER_ACTOR_ID];
    const hq = layout.homes.kash;
    assert.ok(home);
    assert.ok(hq);
    assert.equal(roomAt(layout, home).id, "hq");
    assert.ok(Math.hypot(home.x - hq.x, home.z - hq.z) > 0.8);
    const record = seedOfficeRecord();
    assert.equal(record.bots.some((bot) => bot.id === OWNER_ACTOR_ID), false);
    assert.notEqual(defaultCharacter(OWNER_LOOK_SEED).palette.primary, defaultCharacter(OWNER_ACTOR_ID).palette.primary);
  });

  test("the owner stays at the HQ desk during trips and meetings", () => {
    const layout = buildOfficeLayout();
    const state = createSimState(layout, ["life", OWNER_ACTOR_ID]);
    const owner = state.bots[OWNER_ACTOR_ID];
    assert.ok(owner);
    const x = owner.x;
    const z = owner.z;
    for (let i = 0; i < 80; i += 1) {
      stepOfficeSim(state, layout, 0.08, {
        meeting: [],
        statuses: { life: "working", [OWNER_ACTOR_ID]: "idle" },
        rng: () => 0,
      });
    }
    assert.equal(owner.path.length, 0);
    assert.equal(owner.x, x);
    assert.equal(owner.z, z);

    stepOfficeSim(state, layout, 0.08, {
      meeting: [OWNER_ACTOR_ID, "life"],
      statuses: { life: "working", [OWNER_ACTOR_ID]: "idle" },
      rng: () => 0,
    });
    assert.equal(owner.path.length, 0);
    assert.equal(owner.x, x);
    assert.equal(owner.z, z);
    assert.ok((state.bots.life?.path.length ?? 0) > 0);
  });

  test("the office draws You from the saved character and refreshes it on return", () => {
    const app = source("src/components/worlds/office-app.tsx");
    const canvas = source("src/components/worlds/office-canvas.tsx");
    assert.match(app, /mine=1/);
    assert.match(app, /name: "You"/);
    assert.match(app, /HQ desk/);
    assert.match(app, /aria-label="You"/);
    assert.match(app, /OWNER_ACTOR_ID/);
    assert.match(canvas, /OWNER_LOOK_SEED/);
    assert.match(app, /pageshow/);
    assert.match(app, /visibilitychange/);
  });
});
