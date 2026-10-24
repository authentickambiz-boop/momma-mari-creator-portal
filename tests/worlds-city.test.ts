import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildOfficeLayout, OFFICE_SECTIONS } from "../src/lib/worlds/office-layout";
import { HQ_BOT_ID } from "../src/lib/worlds/office-layout";
import { isBotOfficePath } from "../src/lib/worlds/office-path";
import { worldsReturnPath } from "../src/lib/worlds/office-return";
import {
  ASSET_OWNER,
  CITY_SHOP,
  EARNINGS_CAP_CENTS,
  HOME_TIERS,
  REAL_PAYMENTS,
  apartmentFloors,
  formatKash,
  refuseRealPayment,
} from "../src/lib/worlds/economy";
import { worldsCityEnabled } from "../src/lib/worlds/city/flag";
import { cityNightWeather, cityOverviewHome, districtBillboard, interiorStand, officeTargetBounds, poseInsideBounds } from "../src/lib/worlds/city/scene-shell";
import { homeRoomShift, housingInteriorSize, interiorAisle, interiorLayout, interiorModels, interiorPathClear } from "../src/lib/worlds/city/interiors";
import { decorGrid, evaluatePlacement, firstOpenCell, housingModelForTier, reservedWalkCells } from "../src/lib/worlds/city/decorate";
import { HOUSE_ROW_GAP, STUDIO_ROW_GAP, gableSlabs, rowRoofClearance, shedSlab, slabPoint } from "../src/lib/worlds/city/roofs";
import { CITY_PARK, MANSION_FOUNTAIN, curbOuterRadius, curbReturns, paveCity, roadPieces } from "../src/lib/worlds/city/streets";
import { officeCameraHome, officeCameraPoseOk } from "../src/lib/worlds/office-move";
import {
  CITY_LOCATION_IDS,
  CITY_LOCATIONS,
  boxesOverlap,
  buildCityDistrict,
  placedLocations,
} from "../src/lib/worlds/city/locations";
import { buildingInteractables, officeInteractables, worldInteractables } from "../src/lib/worlds/city/interactables";
import { decideEnter } from "../src/lib/worlds/city/access";
import { WORLDS_TEXT_REJECTION, worldsTextRejection } from "../src/lib/worlds/safety";
import { insideOffice, roleMayStand } from "../src/lib/worlds/city/movement";
import { runPracticeLocation, runPracticeTask } from "../src/lib/worlds/city/practice";
import { createSimState, stepOfficeSim } from "../src/lib/worlds/office-sim";
import {
  CITY_TASKS,
  LIVE_EMAIL_SEND,
  LIVE_SOCIAL_ACTIONS,
  buyCityItem,
  claimApartmentUnit,
  claimCityLot,
  emptyCitySession,
  parseCitySession,
  placeDecorItem,
  removeDecorItem,
  pipelineLabel,
  submitCityTask,
  unlockHomeTier,
} from "../src/lib/worlds/city/tasks";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("the city flag defaults off and the route stays owner-only", () => {
  const previous = process.env.WORLDS_CITY;
  delete process.env.WORLDS_CITY;
  assert.equal(worldsCityEnabled(), false);
  assert.equal(worldsCityEnabled({ WORLDS_CITY: "TRUE" }), false);
  assert.equal(worldsCityEnabled({ WORLDS_CITY: "true" }), true);
  if (previous === undefined) delete process.env.WORLDS_CITY;
  else process.env.WORLDS_CITY = previous;

  assert.equal(isBotOfficePath("/worlds/city"), true);
  assert.equal(isBotOfficePath("/portal/worlds/city", "/portal"), true);
  assert.equal(isBotOfficePath("/worlds/extra"), false);
  assert.equal(worldsReturnPath("/worlds/city"), "/worlds/city");
  assert.equal(worldsReturnPath("/portal/worlds/city"), "/worlds/city");
  assert.equal(worldsReturnPath("/worlds/extra"), null);

  const page = source("src/app/worlds/city/page.tsx");
  const office = source("src/app/worlds/page.tsx");
  assert.match(page, /worldsCityEnabled/);
  assert.match(page, /isOwner/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /cityMode/);
  assert.equal(office.includes("cityMode"), false);
  assert.match(source(".env.example"), /WORLDS_CITY=/);
  assert.match(source("src/proxy.ts"), /\/worlds\/city/);
});

test("every location has the city fields and the required real-world categories", () => {
  const layout = buildOfficeLayout();
  const placed = placedLocations(layout);
  assert.deepEqual(placed.map((item) => item.id), [...CITY_LOCATION_IDS]);
  for (const location of placed) {
    assert.ok(location.name);
    assert.ok(location.buildingModel);
    assert.ok(Number.isFinite(location.entrance.x) && Number.isFinite(location.entrance.z));
    if (location.id === "learning-center" || location.id === "home" || location.id === "library" || location.id === "call-center" || location.id === "art-studio") assert.equal(location.interior, "walk-in");
    else assert.equal(location.interior, "panel");
    assert.ok(location.taskTypes.length > 0);
    assert.ok(Array.isArray(location.skills));
    assert.ok(Array.isArray(location.shop));
    assert.ok(location.realWorldCategory);
  }
  const byId = Object.fromEntries(CITY_LOCATIONS.map((item) => [item.id, item]));
  assert.equal(byId["research-lab"]?.realWorldCategory, "brand and market research");
  assert.equal(byId["call-center"]?.realWorldCategory, "outreach call scripts and reviewed DMs");
  assert.equal(byId["art-studio"]?.realWorldCategory, "thumbnails and graphics");
  assert.equal(byId["music-studio"]?.realWorldCategory, "audio snippets");
  assert.equal(byId["computer-lab"]?.realWorldCategory, "data entry and QA");
  assert.equal(byId.library?.realWorldCategory, "content summaries");
  assert.equal(byId["learning-center"]?.name, "Learning center");
  assert.match(byId["learning-center"]?.summary ?? "", /not a school/i);
  assert.equal(byId.office?.usesOfficeScene, true);
  assert.equal(byId.office?.buildingModel, "hq");
  const hq = placed.find((item) => item.id === "office");
  assert.ok(hq && hq.plot.w > 8 && hq.plot.d > 5);
  for (const street of buildCityDistrict(layout).streets) {
    assert.equal(boxesOverlap(hq?.plot ?? { x: 0, z: 0, w: 0, d: 0 }, street, 0.05), false);
  }
  assert.equal(byId.bank?.reusesBank, true);
  assert.deepEqual(HOME_TIERS, ["studio", "apartment", "house", "creator-loft", "mansion"]);
});

test("streets and buildings sit around the office without covering it", () => {
  const layout = buildOfficeLayout();
  const district = buildCityDistrict(layout, "mansion");
  const office = { x: 0, z: 0, w: layout.width, d: layout.depth };
  assert.ok(district.streets.length >= 4);
  assert.equal(district.bounds.kind, "city");
  for (const plot of district.plots) {
    if (plot.id === "office") continue;
    assert.equal(boxesOverlap(plot, office), false, plot.id);
    assert.ok(plot.x >= district.bounds.minX && plot.x + plot.w <= district.bounds.maxX);
    assert.ok(plot.z >= district.bounds.minZ && plot.z + plot.d <= district.bounds.maxZ);
  }
  for (let i = 0; i < district.plots.length; i += 1) {
    for (let j = i + 1; j < district.plots.length; j += 1) {
      const a = district.plots[i];
      const b = district.plots[j];
      assert.equal(boxesOverlap(a, b, 0.2), false, `${a.id} ${b.id}`);
    }
  }
  const studio = district.plots.find((item) => item.id === "studio-row");
  const apartment = district.plots.find((item) => item.id === "apartment-complex");
  const house = district.plots.find((item) => item.id === "house-lane");
  const loft = district.plots.find((item) => item.id === "loft-block");
  const mansion = district.plots.find((item) => item.id === "mansion-grounds");
  assert.ok(studio && apartment && house && loft && mansion);
  const area = (plot: { w: number; d: number } | undefined) => (plot ? plot.w * plot.d : 0);
  assert.ok(area(apartment) > area(studio));
  assert.ok(area(house) > area(apartment));
  assert.ok(area(loft) > area(house));
  assert.ok(area(mansion) > area(loft));
  assert.equal(apartment?.yard, "none");
  assert.equal(apartment?.propertyTier, "apartment");
  assert.equal(studio?.propertyTier, "studio");
  assert.equal(mansion?.propertyTier, "mansion");
  assert.ok(mansion && studio && mansion.floors > studio.floors);
});

test("the office camera clamp is unchanged and the city view pulls back", () => {
  const layout = buildOfficeLayout();
  const bounds = officeTargetBounds(layout);
  assert.equal(bounds.minX, -14);
  assert.equal(bounds.maxX, layout.width + 14);
  assert.equal(bounds.minZ, -14);
  assert.equal(bounds.maxZ, layout.depth + 28);
  assert.equal(bounds.maxY, 3.2);
  const office = officeCameraHome(layout.width, layout.depth);
  const city = cityOverviewHome(layout);
  assert.ok(city.distance > office.position.distanceTo(office.target));
  assert.equal(poseInsideBounds(city.position, city.target, buildCityDistrict(layout).bounds), true);
  assert.equal(officeCameraPoseOk(office.position, office.target, layout), true);
  const canvas = source("src/components/worlds/office-canvas.tsx");
  assert.match(canvas, /officeCameraPoseOk/);
  assert.match(canvas, /city \?/);
  assert.match(canvas, /WorldSceneShell/);
  assert.match(canvas, /CityLayer/);
  const sign = districtBillboard("APARTMENT COMPLEX");
  assert.ok(sign.tall >= 6);
  assert.ok(sign.wide >= 26);
  const inside = interiorStand({ x: 72, z: 4, w: 9, d: 10, yaw: -Math.PI / 2 });
  const dx = inside.eye.x - inside.aim.x;
  const dy = inside.eye.y - inside.aim.y;
  const dz = inside.eye.z - inside.aim.z;
  const distance = Math.hypot(dx, dy, dz);
  assert.ok(distance >= 3.2 && distance <= 12);
  assert.ok(Math.acos(dy / distance) <= Math.PI / 2.2 + 0.02);
  const layer = source("src/components/worlds/city/city-layer.tsx");
  assert.equal(layer.includes("hemisphereLight"), false);
  assert.equal(layer.includes("directionalLight"), false);
  assert.match(layer, /DoorPaths/);
  assert.match(layer, /Verges/);
  const panel = source("src/components/worlds/city/city-panel.tsx");
  assert.match(panel, /aria-label="Places"/);
  assert.match(panel, /quality checks/);
  assert.match(panel, /Auto check/);
  assert.equal(panel.includes("city-places"), false);
  const app = source("src/components/worlds/office-app.tsx");
  assert.match(app, /cityMode \? cityDayWeather/);
  assert.match(app, /if \(cityMode\) return/);
  assert.match(source("src/components/worlds/city/building.tsx"), /interior-objective/);
  assert.match(source("src/components/worlds/city/building.tsx"), /side=\{DoubleSide\}/);
});

test("interior furniture stays on the walls and the aisle reaches the marker", () => {
  const sizes = [
    [8.6, 5.6],
    [6.5, 6.2],
    [5, 5.8],
    [2.3, 3],
    [10, 6.3],
    [11.4, 4.2],
    [12, 7.9],
  ];
  for (const model of interiorModels()) {
    for (const [w, d] of sizes) {
      const pieces = interiorLayout(model, w, d);
      assert.equal(interiorPathClear(pieces, w, d), true, `${model} ${w}x${d}`);
      assert.ok(pieces.some((piece) => piece.marker), model);
      assert.ok(pieces.some((piece) => piece.zone === "work"), model);
      assert.ok(pieces.some((piece) => piece.zone === "lounge"), model);
      assert.ok(pieces.some((piece) => piece.zone === "decor" && !piece.glass), model);
      assert.ok(pieces.filter((piece) => piece.glass).length >= 2, model);
    }
  }
  const house = interiorLayout("houses", 5.6, 6.2);
  assert.ok(house.some((piece) => piece.prop === "sofa"));
  assert.ok(house.some((piece) => piece.prop === "desk"));
  assert.ok(house.some((piece) => piece.prop === "table"));
  assert.ok(house.some((piece) => piece.prop === "lamp"));
  assert.ok(house.some((piece) => piece.prop === "tv"));
  assert.ok(house.some((piece) => piece.prop === "kitchen"));
  assert.ok(house.some((piece) => piece.prop === "coffee"));
  assert.ok(house.some((piece) => piece.prop === "bed"));
  assert.ok(house.some((piece) => piece.prop === "floorlamp"));
  const loftRoom = interiorLayout("loft", 11.9, 7.5);
  assert.ok(loftRoom.some((piece) => piece.prop === "kitchen"));
  assert.ok(loftRoom.some((piece) => piece.prop === "table"));
  assert.ok(loftRoom.some((piece) => piece.prop === "coffee"));
  const library = interiorLayout("library", 11.25, 8.25);
  assert.ok(library.filter((piece) => piece.prop === "shelf").length >= 3);
  assert.ok(library.some((piece) => piece.prop === "books"));
  const call = interiorLayout("call-center", 8.25, 9.25);
  assert.ok(call.filter((piece) => piece.prop === "booth").length >= 4);
  assert.ok(call.some((piece) => piece.prop === "notes"));
  assert.ok(call.some((piece) => piece.prop === "tv"));
  const bank = interiorLayout("bank", 12.25, 8.25);
  assert.ok(bank.some((piece) => piece.prop === "counter"));
  assert.ok(bank.some((piece) => piece.prop === "vault"));
  assert.ok(bank.some((piece) => piece.prop === "atm"));
  assert.ok(bank.some((piece) => piece.prop === "queue"));
  const aisle = interiorAisle(8, 6);
  assert.ok(aisle.d > 1);
  assert.ok(aisle.objectiveZ < aisle.z);
  const loft = homeRoomShift("loft", 34, 16);
  assert.ok(loft.x < -5);
  assert.equal(homeRoomShift("houses", 28, 16).x, 0);
  assert.equal(homeRoomShift("library", 12, 9).x, 0);
  const shifted = interiorStand({ x: 6, z: 80, w: 34, d: 16, yaw: Math.PI }, loft);
  const centered = interiorStand({ x: 6, z: 80, w: 34, d: 16, yaw: Math.PI });
  assert.ok(Math.hypot(shifted.eye.x - centered.eye.x, shifted.eye.z - centered.eye.z) > 4);
});

test("decorate snaps to the housing grid and refuses overlaps", () => {
  const tiers = [
    ["studio", 0],
    ["apartment", 0],
    ["house", 0],
    ["creator-loft", 0],
    ["mansion", 0],
  ] as const;
  const layout = buildOfficeLayout();
  for (const [tier] of tiers) {
    const model = housingModelForTier(tier);
    const district = buildCityDistrict(layout, tier);
    const plot = district.plots.find((item) => item.propertyTier === tier);
    assert.ok(plot, tier);
    const room = { model, ...housingInteriorSize(model, plot.w, plot.d) };
    assert.ok(room.w > 2 && room.d > 2, tier);
    const grid = decorGrid(room.w, room.d);
    assert.ok(grid.cols >= 4 && grid.rows >= 4, tier);
    const pieces = interiorLayout(model, room.w, room.d);
    assert.equal(interiorPathClear(pieces, room.w, room.d), true, tier);
    const walk = reservedWalkCells(grid, room.w, room.d);
    assert.ok(walk.size > 0, tier);
    const open = firstOpenCell(room, [], "plant", 0);
    assert.ok(open, tier);
    const session = { ...emptyCitySession(), homeTier: tier, kashCents: 500_000 };
    const placed = placeDecorItem(session, "owner", room, { sku: "plant", gx: open.gx, gz: open.gz, turns: 0 }, 10);
    assert.equal(placed.ok, true);
    if (!placed.ok) return;
    const again = placeDecorItem(placed.session, "owner", room, { sku: "chair", gx: open.gx, gz: open.gz, turns: 0 }, 11);
    assert.equal(again.ok, false);
    if (again.ok) return;
    assert.match(again.error, /overlap|walk/i);
    const stranger = placeDecorItem(session, "user", room, { sku: "plant", gx: open.gx, gz: open.gz, turns: 0 }, 12);
    assert.equal(stranger.ok, false);
    const walkCell = [...walk][0]?.split(",").map(Number) ?? [0, 0];
    const blockedWalk = evaluatePlacement(room, [], { sku: "plant", gx: walkCell[0] ?? 0, gz: walkCell[1] ?? 0, turns: 0 });
    assert.equal(blockedWalk.ok, false);
    const kept = parseCitySession(JSON.stringify(placed.session));
    assert.equal(kept?.decorPlacements.length, 1);
    const removed = removeDecorItem(placed.session, "owner", placed.session.decorPlacements[0]?.id ?? "");
    assert.equal(removed.ok, true);
    if (removed.ok) assert.equal(removed.session.decorPlacements.length, 0);
  }
});

test("office taps and city buildings share one registry", () => {
  const layout = buildOfficeLayout();
  const bots = [{ id: HQ_BOT_ID, name: "Kash" }];
  const office = officeInteractables(layout, OFFICE_SECTIONS, bots);
  assert.ok(office.some((item) => item.kind === "calendar"));
  assert.ok(office.some((item) => item.kind === "todos"));
  assert.ok(office.some((item) => item.kind === "box"));
  assert.ok(office.some((item) => item.kind === "conference"));
  assert.ok(office.some((item) => item.kind === "bank" && item.reuses === "vault-bank"));
  assert.ok(office.some((item) => item.kind === "bot" && item.botId === HQ_BOT_ID));
  const district = buildCityDistrict(layout);
  const buildings = buildingInteractables(district);
  assert.equal(buildings.length, district.plots.length);
  assert.equal(new Set(buildings.map((item) => item.locationId)).size, CITY_LOCATION_IDS.length);
  assert.equal(buildings.find((item) => item.locationId === "bank")?.reuses, "vault-bank");
  assert.equal(buildings.find((item) => item.locationId === "office")?.reuses, "office-scene");
  const all = worldInteractables(layout, OFFICE_SECTIONS, bots, district);
  assert.equal(all.length, office.length + buildings.length);
  assert.equal(worldInteractables(layout, OFFICE_SECTIONS, bots, null).length, office.length);
});

test("real work is opt-in, disclosed, skill-gated, and paid in Kash without a cap", () => {
  assert.equal(EARNINGS_CAP_CENTS, null);
  assert.equal(REAL_PAYMENTS, false);
  assert.equal(refuseRealPayment().charged, false);
  assert.equal(ASSET_OWNER, "Momma Mari");
  const paid = CITY_TASKS.filter((item) => item.realWork);
  assert.ok(paid.length >= 6);
  for (const item of paid) {
    assert.match(item.disclosure, /Momma Mari/);
    assert.match(item.disclosure, /Kash \$/);
    assert.match(item.disclosure, /optional/i);
    if (item.kind !== "social") assert.ok(item.requiresSkill);
    assert.ok(item.pipeline.autoChecks.length > 0);
  }
  const lessons = CITY_TASKS.filter((item) => item.kind === "lesson");
  assert.ok(lessons.every((item) => item.locationId === "learning-center"));
  assert.ok(lessons.every((item) => /not a school/i.test(item.disclosure)));
  assert.equal(formatKash(800), "Kash $8.00");

  let session = emptyCitySession();
  const locked = submitCityTask(session, "research-scan", { optIn: true, note: "A sample scan.", now: 1_000 });
  assert.equal(locked.ok, false);
  const skipped = submitCityTask(session, "lesson-research", { optIn: false, note: "no", now: 1_000 });
  assert.equal(skipped.ok, false);
  const lesson = submitCityTask(session, "lesson-research", { optIn: true, note: "Look for the audience.", now: 1_000 });
  assert.equal(lesson.ok, true);
  if (!lesson.ok) return;
  session = lesson.session;
  assert.ok(session.skills.includes("research"));
  assert.equal(session.kashCents, 0);

  let now = 10_000;
  for (let count = 0; count < 5; count += 1) {
    const result = submitCityTask(session, "research-scan", { optIn: true, note: `Sample scan ${count}`, now });
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    if (!result.ok) return;
    session = result.session;
    now += 61_000;
  }
  assert.equal(session.kashCents, 4_000);
  const capped = submitCityTask(session, "research-scan", { optIn: true, note: "One more sample.", now });
  assert.equal(capped.ok, false);

  now += 86_400_000;
  for (let count = 0; count < 7; count += 1) {
    const result = submitCityTask(session, "research-scan", { optIn: true, note: `Later scan ${count}`, now });
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    if (!result.ok) return;
    session = result.session;
    now += 86_400_000;
  }
  assert.equal(session.kashCents, 4_000 + 7 * 800);
  assert.ok(session.submissions.length > 5);
  assert.match(source("src/lib/worlds/city/tasks.ts"), /Nothing is sent/);
  assert.equal(source("src/lib/worlds/city/tasks.ts").includes("fetch("), false);
  assert.equal(source("src/lib/worlds/economy.ts").includes("stripe"), false);
});

test("shops and home tiers spend Kash and stay owned by Momma Mari", () => {
  let session = emptyCitySession();
  session = { ...session, kashCents: 50_000 };
  const bought = buyCityItem(session, "city-jacket", 5_000);
  assert.equal(bought.ok, true);
  if (!bought.ok) return;
  assert.match(bought.message, /Momma Mari owns this/);
  assert.match(bought.message, /No real payment/);
  assert.equal(bought.session.kashCents, 50_000 - 6_000);
  assert.ok(bought.session.ownedSkus.includes("city-jacket"));
  const again = buyCityItem(bought.session, "city-jacket", 8_000);
  assert.equal(again.ok, false);

  const studio = unlockHomeTier(bought.session, "studio", 9_000);
  assert.equal(studio.ok, false);
  const house = unlockHomeTier(bought.session, "house", 9_000);
  assert.equal(house.ok, true);
  if (!house.ok) return;
  assert.equal(house.session.homeTier, "house");
  assert.match(house.message, /Momma Mari owns/);
  const cook = submitCityTask(house.session, "home-cook", { optIn: true, note: "", now: 20_000 });
  assert.equal(cook.ok, true);
  const gallery = submitCityTask(house.session, "home-gallery", { optIn: true, note: "", now: 30_000 });
  assert.equal(gallery.ok, false);
  assert.ok(CITY_SHOP.some((item) => item.locationId === "clothing-shop"));
  assert.ok(CITY_SHOP.some((item) => item.locationId === "furniture-shop"));
  const panel = source("src/components/worlds/city/city-panel.tsx");
  assert.ok(panel.indexOf("city-disclosure") < panel.indexOf("I choose to do this"));

  const apartment = { ...emptyCitySession(), homeTier: "apartment" as const, kashCents: 50_000 };
  const patio = buyCityItem(apartment, "city-patio", 1_000);
  assert.equal(patio.ok, false);
  if (patio.ok) return;
  assert.match(patio.error, /cannot buy yard, outdoor, or oversized/);
  assert.deepEqual(apartment.windows, {});
});

test("building tasks stay in practice, drafts, and the quality pipeline", () => {
  assert.equal(LIVE_SOCIAL_ACTIONS, false);
  assert.equal(LIVE_EMAIL_SEND, false);
  const tasks = source("src/lib/worlds/city/tasks.ts");
  assert.equal(tasks.includes("fetch("), false);
  assert.equal(tasks.includes("mailto:"), false);
  assert.equal(tasks.includes("nodemailer"), false);

  const like = CITY_TASKS.find((item) => item.id === "social-like");
  const email = CITY_TASKS.find((item) => item.id === "call-email");
  const story = CITY_TASKS.find((item) => item.id === "library-story");
  assert.ok(like && email && story);
  assert.equal(like?.external, "social");
  assert.equal(like?.practice, true);
  assert.equal(email?.external, "email");
  assert.equal(pipelineLabel(email!), "Auto check → peer or bot score → owner gate");
  assert.match(like?.disclosure ?? "", /Nothing is posted/);
  assert.match(email?.disclosure ?? "", /never auto-sent/);
  assert.match(story?.disclosure ?? "", /Momma Mari/);

  let session = emptyCitySession();
  const lesson = submitCityTask(session, "lesson-writing", { optIn: true, note: "A summary names the point.", now: 1_000 });
  assert.equal(lesson.ok, true);
  if (!lesson.ok) return;
  session = lesson.session;
  const outreach = submitCityTask(session, "lesson-outreach", { optIn: true, note: "Hello, then one ask.", now: 2_000 });
  assert.equal(outreach.ok, true);
  if (!outreach.ok) return;
  session = outreach.session;

  const thin = submitCityTask(session, "library-story", { optIn: true, note: "Too short.", now: 10_000 });
  assert.equal(thin.ok, false);
  const told = submitCityTask(session, "library-story", {
    optIn: true,
    note: "A Friday drop waited on the shelf until Mara pressed play and the room went quiet.",
    now: 20_000,
  });
  assert.equal(told.ok, true);
  if (!told.ok) return;
  assert.match(told.message, /Peer score/);
  assert.match(told.message, /Nothing was sent/);
  session = told.session;

  const read = submitCityTask(session, "library-read", { optIn: true, note: "", now: 30_000 });
  assert.equal(read.ok, true);
  if (!read.ok) return;
  assert.match(read.message, /Hidden tip/);
  assert.ok(read.session.libraryTips.length > 0);
  session = read.session;

  const bare = submitCityTask(session, "call-email", { optIn: true, note: "Please look at Friday.", now: 40_000 });
  assert.equal(bare.ok, false);
  const draft = submitCityTask(session, "call-email", {
    optIn: true,
    note: "Hi, the Friday cut is ready for a look. One note is enough. Thank you.",
    now: 50_000,
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  assert.match(draft.message, /Held for Kamron/);
  assert.match(draft.message, /Nothing was sent/);
  assert.equal(draft.session.kashCents, session.kashCents + 850);

  let social = emptyCitySession();
  let now = 60_000;
  for (let count = 0; count < 8; count += 1) {
    const result = submitCityTask(social, "social-like", { optIn: true, note: `Like the Friday clip ${count}.`, now });
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    if (!result.ok) return;
    social = result.session;
    now += 21_000;
  }
  const capped = submitCityTask(social, "social-comment", { optIn: true, note: "The Friday still is sharp.", now });
  assert.equal(capped.ok, false);

  const office = CITY_LOCATIONS.find((item) => item.id === "office");
  assert.ok(office);
  const userLocked = decideEnter(office, "user", emptyCitySession());
  assert.equal(userLocked.open, false);
  assert.match(userLocked.reason, /Only Kamron and the office roster/);
});

test("the owner practice harness runs every social, library, and call-center task without sending", () => {
  assert.equal(worldsCityEnabled({}), false);
  assert.equal(worldsCityEnabled({ WORLDS_CITY: "true" }), true);
  assert.equal(LIVE_SOCIAL_ACTIONS, false);
  assert.equal(LIVE_EMAIL_SEND, false);
  const page = source("src/app/worlds/city/page.tsx");
  assert.match(page, /isOwner/);
  assert.match(page, /worldsCityEnabled/);
  const harness = source("src/lib/worlds/city/practice.ts");
  assert.equal(harness.includes("fetch("), false);
  assert.equal(harness.includes("mailto:"), false);

  const covered = new Set<string>();
  for (const locationId of ["social-club", "library", "call-center"] as const) {
    const runs = runPracticeLocation(locationId);
    assert.ok(runs.length >= 4, locationId);
    for (const run of runs) {
      assert.equal(run.ok, true, run.ok ? run.taskId : `${run.taskId}: ${run.error}`);
      if (!run.ok) continue;
      covered.add(run.taskId);
      assert.equal(run.sent, false);
      assert.equal(run.balanceCents, run.payoutCents);
      assert.match(run.message, /Nothing was (posted|sent)/);
      const task = CITY_TASKS.find((item) => item.id === run.taskId);
      assert.equal(task?.locationId, locationId);
      if (task?.pipeline.peerScore) assert.equal(typeof run.score, "number");
      if (task?.external === "social") assert.match(run.message, /Nothing was posted/);
      if (task?.external === "email") {
        assert.match(run.message, /Nothing was sent/);
        assert.match(run.message, /Held for Kamron/);
      }
    }
  }
  const expected = CITY_TASKS.filter((item) => item.locationId === "social-club" || item.locationId === "library" || item.locationId === "call-center");
  assert.equal(covered.size, expected.length);

  for (const task of CITY_TASKS) {
    const run = runPracticeTask(task.id, 2_000_000);
    assert.equal(run.ok, true, run.ok ? task.id : `${task.id}: ${run.error}`);
    if (!run.ok) continue;
    assert.equal(run.sent, false);
    assert.equal(run.balanceCents, task.payoutCents);
    assert.equal(run.message.includes("http"), false);
  }
});

test("office roster bots stay inside the office until the city connects", () => {
  const layout = buildOfficeLayout();
  const state = createSimState(layout, [HQ_BOT_ID]);
  const bot = state.bots[HQ_BOT_ID];
  assert.ok(bot);
  bot.path = [{ x: -40, z: -40 }];
  stepOfficeSim(state, layout, 0.05, { meeting: [], statuses: {}, rng: () => 0.2 });
  assert.equal(bot.path.length, 0);
  assert.equal(bot.act, "At desk");
  assert.ok(insideOffice(layout, bot.x, bot.z, 0.2));
  assert.equal(roleMayStand("officeBot", layout, -30, -30), false);
  assert.equal(roleMayStand("user", layout, 4, 4), false);
  assert.equal(roleMayStand("user", layout, -30, -30), true);
  assert.equal(roleMayStand("owner", layout, -30, -30), true);
});

test("worlds has no adult copy and refuses that kind of note", () => {
  const lines = [
    ...CITY_LOCATIONS.flatMap((location) => [location.name, location.summary, location.realWorldCategory, ...location.interiorProps]),
    ...CITY_TASKS.flatMap((item) => [item.name, item.prompt, item.disclosure, ...item.pipeline.autoChecks]),
    ...CITY_SHOP.flatMap((item) => [item.name, item.note]),
    "Sample: add a Friday gaming-sponsor check-in.",
    "Look for the audience.",
  ];
  for (const line of lines) assert.equal(worldsTextRejection(line), null, line);
  const session = emptyCitySession();
  const refused = submitCityTask(session, "social-comment", { optIn: true, note: "n.s.f.w", now: 5_000 });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.error, WORLDS_TEXT_REJECTION);
  assert.equal(session.submissions.length, 0);
  assert.equal(session.kashCents, 0);
  assert.equal(Object.keys(session.windows).length, 0);
  const folded = submitCityTask(session, "social-like", { optIn: true, note: "s3x", now: 6_000 });
  assert.equal(folded.ok, false);
  if (!folded.ok) assert.equal(folded.error, WORLDS_TEXT_REJECTION);
});

function boxGap(a: { x: number; z: number; w: number; d: number }, b: { x: number; z: number; w: number; d: number }) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dz = Math.max(0, Math.max(a.z - (b.z + b.d), b.z - (a.z + a.d)));
  return Math.hypot(dx, dz);
}

test("neighborhood streets, empty lots, and a taller apartment stay in practice", () => {
  const layout = buildOfficeLayout();
  const district = buildCityDistrict(layout, "studio", 0);
  const blockers = [...district.plots, ...district.lots];
  for (let i = 0; i < blockers.length; i += 1) {
    for (let j = i + 1; j < blockers.length; j += 1) {
      const a = blockers[i];
      const b = blockers[j];
      assert.equal(boxesOverlap(a, b, 0.15), false, `${a.id} ${b.id}`);
    }
  }
  for (const street of district.streets) {
    for (const box of blockers) {
      assert.equal(boxesOverlap(street, box, 0.05), false, `${street.id} ${box.id}`);
    }
  }
  assert.equal(district.lots.some((lot) => lot.districtId === "apartment-complex"), false);
  for (const tier of ["studio", "house", "creator-loft", "mansion"] as const) {
    const lots = district.lots.filter((lot) => lot.tier === tier);
    assert.ok(lots.length >= 2, tier);
    assert.ok(lots.every((lot) => lot.priceCents > 0 && lot.number.length > 0));
  }
  const studio = district.plots.find((item) => item.id === "studio-row");
  const house = district.plots.find((item) => item.id === "house-lane");
  const loft = district.plots.find((item) => item.id === "loft-block");
  const mansion = district.plots.find((item) => item.id === "mansion-grounds");
  const apartment = district.plots.find((item) => item.id === "apartment-complex");
  assert.ok(studio && house && loft && mansion && apartment);
  const area = (box: { w: number; d: number }) => box.w * box.d;
  for (const lot of district.lots.filter((item) => item.tier === "studio")) assert.ok(area(lot) < area(studio));
  for (const lot of district.lots.filter((item) => item.tier === "house")) assert.ok(area(lot) < area(house) && area(lot) > area(studio) / 2);
  for (const lot of district.lots.filter((item) => item.tier === "creator-loft")) assert.ok(area(lot) < area(loft) && area(lot) > area(house) / 3);
  for (const lot of district.lots.filter((item) => item.tier === "mansion")) assert.ok(area(lot) > area(loft) * 0.7);
  assert.equal(apartment.yard, "none");
  assert.equal(apartment.floors, 3);
  const grown = buildCityDistrict(layout, "apartment", 2);
  assert.equal(grown.plots.find((item) => item.id === "apartment-complex")?.floors, 5);
  assert.equal(grown.lots.length, district.lots.length);
  const roads = district.streets.filter((street) => street.kind === "road");
  const housing = [...district.plots.filter((plot) => plot.propertyTier), ...district.lots];
  for (const box of housing) {
    const near = Math.min(...district.streets.map((street) => boxGap(box, street)));
    assert.ok(near < 3.2, `${box.id} ${near}`);
  }
  for (const id of ["road-studio-row", "road-apartment", "road-house", "road-loft", "road-mansion"]) {
    const road = roads.find((item) => item.id === id);
    assert.ok(road, id);
    const touches = roads.some((other) => other.id !== id && boxGap(road, other) < 0.35);
    assert.equal(touches, true, id);
    assert.ok(district.streets.some((street) => street.id.startsWith(`${id}-walk-`)));
  }
  const layer = source("src/components/worlds/city/city-layer.tsx");
  assert.match(layer, /districtBillboard/);
  assert.match(layer, /BUILD HERE/);
  assert.match(layer, /LotShell/);
  assert.match(source("src/components/worlds/city/building.tsx"), /RisingStory/);
  assert.match(source("src/components/worlds/city/building.tsx"), /StoryBox/);
  assert.match(source("src/components/worlds/city/city-panel.tsx"), /Claim lot/);
  assert.match(source("src/components/worlds/city/city-panel.tsx"), /Claim a unit/);
  assert.equal(LIVE_SOCIAL_ACTIONS, false);
  assert.equal(LIVE_EMAIL_SEND, false);

  const lot = district.lots.find((item) => item.id === "lot-studio-1");
  assert.ok(lot);
  let session = { ...emptyCitySession(), kashCents: 100_000 };
  const denied = claimCityLot(session, lot, "user", 5_000);
  assert.equal(denied.ok, false);
  const poor = claimCityLot({ ...emptyCitySession(), kashCents: 0 }, lot, "owner", 6_000);
  assert.equal(poor.ok, false);
  const claimed = claimCityLot(session, lot, "owner", 8_000);
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;
  session = claimed.session;
  assert.ok(session.claimedLotIds.includes(lot.id));
  assert.equal(session.kashCents, 100_000 - lot.priceCents);
  assert.match(claimed.message, /No real payment/);
  const again = claimCityLot(session, lot, "owner", 20_000);
  assert.equal(again.ok, false);
  const unitDenied = claimApartmentUnit(session, "creatorBot", 30_000);
  assert.equal(unitDenied.ok, false);
  const unit = claimApartmentUnit(session, "owner", 40_000);
  assert.equal(unit.ok, true);
  if (!unit.ok) return;
  assert.equal(unit.session.apartmentUnits, 1);
  assert.equal(apartmentFloors(unit.session.apartmentUnits), 4);
  assert.match(unit.message, /No empty yard/);
  assert.match(unit.message, /No real payment/);
  const kept = parseCitySession(JSON.stringify(unit.session));
  assert.ok(kept);
  assert.deepEqual(kept.claimedLotIds, [lot.id]);
  assert.equal(kept.apartmentUnits, 1);
});

test("ownable roofs sit on the walls and roads are not drawn twice", () => {
  const layout = buildOfficeLayout();
  const district = buildCityDistrict(layout);
  const gable = gableSlabs(7.2, 3.3);
  for (const slab of gable.slabs) {
    const eave = slabPoint(slab, -Math.sign(slab.rotZ) * slab.length / 2, -slab.thickness / 2);
    const ridge = slabPoint(slab, Math.sign(slab.rotZ) * slab.length / 2, -slab.thickness / 2);
    assert.ok(eave.y > 3.3, `eave ${eave.y}`);
    assert.ok(Math.abs(ridge.x) < 0.05, `ridge x ${ridge.x}`);
    assert.ok(ridge.y > eave.y);
  }
  const shed = shedSlab(8, 4.2);
  const low = slabPoint(shed, 0, -shed.thickness / 2, shed.length / 2);
  assert.ok(low.y > 4.2, `shed eave ${low.y}`);
  const roads = district.streets.filter((street) => street.kind === "road");
  const { segments, crossings } = roadPieces(roads);
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      assert.equal(boxesOverlap(segments[i], segments[j], -0.02), false, `${segments[i].id} ${segments[j].id}`);
    }
    for (const cross of crossings) {
      assert.equal(boxesOverlap(segments[i], cross, -0.02), false, `${segments[i].id} ${cross.id}`);
    }
  }
  const turns = curbReturns(crossings);
  assert.ok(turns.length >= 4);
  const paved = paveCity(roads);
  for (let i = 0; i < paved.asphalt.length; i += 1) {
    for (let j = i + 1; j < paved.asphalt.length; j += 1) {
      assert.equal(boxesOverlap(paved.asphalt[i], paved.asphalt[j], -0.04), false, `${paved.asphalt[i].id} ${paved.asphalt[j].id}`);
    }
  }
  for (let i = 0; i < paved.walks.length; i += 1) {
    for (let j = i + 1; j < paved.walks.length; j += 1) {
      assert.equal(boxesOverlap(paved.walks[i], paved.walks[j], -0.04), false, `${paved.walks[i].id} ${paved.walks[j].id}`);
    }
  }
  const north = roads.find((road) => road.id === "road-north");
  assert.ok(north);
  const northWalk = paved.walks.some((walk) => walk.z + walk.d <= north.z + 0.05 && walk.z + walk.d >= north.z - 0.08 && walk.x < north.x + north.w / 2 && walk.x + walk.w > north.x + north.w / 2);
  assert.equal(northWalk, true, "sidewalk sits on the curb with no grass gap");
  assert.ok(paved.rounds.length >= 8, `rounded curbs ${paved.rounds.length}`);
  assert.ok(paved.caps.length >= 4, `dead-end caps ${paved.caps.length}`);
  assert.ok(paved.rounds.every((turn) => turn.radius >= 0.7 && turn.radius <= 2.5));
  for (const id of ["road-north", "road-south", "road-east", "road-west"]) {
    assert.equal(paved.caps.some((cap) => cap.id.startsWith(id)), false, `${id} is a through road`);
  }
  const south = roads.find((road) => road.id === "road-south");
  const east = roads.find((road) => road.id === "road-east");
  assert.ok(south && east);
  const seamX = Math.max(south.x, east.x);
  const seamZ = Math.max(south.z, east.z);
  const seam = paved.rounds.find((turn) => turn.x > seamX - 2 && turn.z > seamZ - 2 && turn.x < seamX + east.w && turn.z < seamZ + south.d);
  assert.ok(seam, "southeast corner has a rounded return");
  const outer = curbOuterRadius(seam.radius);
  const centerX = east.x + east.w / 2;
  const centerZ = south.z + south.d / 2;
  const dist = Math.hypot(centerX - seam.x, centerZ - seam.z);
  assert.ok(dist < seam.radius - 0.05 || dist > outer, `junction center stays asphalt (${dist.toFixed(2)})`);
  assert.ok(paved.walks.some((walk) => walk.id.includes("corner")), "sidewalk fills the corner");
  for (let i = 0; i < paved.rounds.length; i += 1) {
    for (let j = i + 1; j < paved.rounds.length; j += 1) {
      const a = paved.rounds[i];
      const b = paved.rounds[j];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.4, `${a.id} ${b.id} are stacked`);
    }
  }
  const houseClearance = rowRoofClearance(28 * 0.92, 3, HOUSE_ROW_GAP);
  const studioClearance = rowRoofClearance(18 * 0.92, 4, STUDIO_ROW_GAP);
  assert.ok(houseClearance > 1.6, `house roof gap ${houseClearance}`);
  assert.ok(studioClearance > 0.9, `studio roof gap ${studioClearance}`);
  const blocked = [...district.plots, ...district.lots, ...district.streets];
  assert.equal(blocked.some((box) => boxesOverlap(CITY_PARK, box, 0.2)), false);
  const fountainHits = [...district.lots, ...district.streets, ...district.plots.filter((plot) => plot.id !== "mansion-grounds")];
  assert.equal(fountainHits.some((box) => boxesOverlap(MANSION_FOUNTAIN, box, 0.15)), false);
  const mansion = district.plots.find((plot) => plot.id === "mansion-grounds");
  assert.ok(mansion && boxesOverlap(MANSION_FOUNTAIN, mansion, 0));
  assert.ok(cityNightWeather(new Date()).sunElevation < 0);
  assert.match(source("src/components/worlds/city/building.tsx"), /CityInterior/);
  assert.match(source("src/components/worlds/office-app.tsx"), /Night lighting/);
});
