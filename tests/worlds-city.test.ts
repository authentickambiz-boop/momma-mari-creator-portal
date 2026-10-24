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
  formatKash,
  refuseRealPayment,
} from "../src/lib/worlds/economy";
import { worldsCityEnabled } from "../src/lib/worlds/city/flag";
import { cityOverviewHome, officeTargetBounds, poseInsideBounds } from "../src/lib/worlds/city/scene-shell";
import { officeCameraHome, officeCameraPoseOk } from "../src/lib/worlds/office-move";
import {
  CITY_LOCATION_IDS,
  CITY_LOCATIONS,
  boxesOverlap,
  buildCityDistrict,
  placedLocations,
} from "../src/lib/worlds/city/locations";
import { buildingInteractables, officeInteractables, worldInteractables } from "../src/lib/worlds/city/interactables";
import {
  CITY_TASKS,
  buyCityItem,
  emptyCitySession,
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
    if (location.id === "learning-center" || location.id === "home") assert.equal(location.interior, "walk-in");
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
  const homeStudio = buildCityDistrict(layout, "studio").plots.find((item) => item.id === "home");
  const homeMansion = district.plots.find((item) => item.id === "home");
  assert.ok(homeStudio && homeMansion && homeMansion.w > homeStudio.w);
  assert.ok(homeMansion && homeMansion.floors > (homeStudio?.floors ?? 0));
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
  const layer = source("src/components/worlds/city/city-layer.tsx");
  assert.equal(layer.includes("hemisphereLight"), false);
  assert.equal(layer.includes("directionalLight"), false);
  assert.match(layer, /DoorPaths/);
  assert.match(layer, /Verges/);
  const panel = source("src/components/worlds/city/city-panel.tsx");
  assert.match(panel, /aria-label="Places"/);
  assert.equal(panel.includes("city-places"), false);
  const app = source("src/components/worlds/office-app.tsx");
  assert.match(app, /cityMode \? cityDayWeather/);
  assert.match(app, /if \(cityMode\) return/);
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
  assert.equal(buildings.length, CITY_LOCATION_IDS.length);
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
    assert.ok(item.requiresSkill);
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
});
