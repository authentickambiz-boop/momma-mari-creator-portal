import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { officeCharacters } from "../src/db/schema";
import { nowIso } from "../src/lib/format";
import type { Viewer } from "../src/lib/types";
import {
  applyPalette,
  canOpenCharacterCreator,
  characterAccess,
  characterAccessStatus,
  characterFigure,
  characterPromptVisible,
  LOOKS_POLL_MS,
  characterSubjectForViewer,
  defaultCharacter,
  INNER_TOPS,
  limbRotation,
  missingWornParts,
  nameTagFrame,
  OUTERWEAR_ITEMS,
  parseCharacter,
  randomCharacter,
  slotMeshReady,
  worldsCharacterAccess,
} from "../src/lib/worlds/character";
import { listBotCharacters, readCharacter, writeCharacter } from "../src/lib/worlds/character-store";
import { OFFICE_BOTS } from "../src/lib/worlds/office-catalog";
import { OFFICE_POLL_MS } from "../src/lib/worlds/office-state";
import { isBotOfficePath } from "../src/lib/worlds/office-path";
import { worldsReturnPath } from "../src/lib/worlds/office-return";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const manager: Viewer = {
  email: "manager@example.com",
  role: "manager",
  creatorId: null,
  name: "Manager",
  managerId: "mgr1",
};

describe("Worlds characters", () => {
  test("the look schema rejects unknown fields and versions", () => {
    const config = defaultCharacter("content");
    const parsed = parseCharacter(config);
    assert.equal(parsed.ok, true);
    assert.equal(parseCharacter({ ...config, price: 5 }).ok, false);
    assert.equal(parseCharacter({ ...config, version: 2 }).ok, false);
    assert.equal(parseCharacter({ ...config, body: { ...config.body, color: "red" } }).ok, false);
    for (let i = 0; i < 12; i += 1) assert.equal(parseCharacter(randomCharacter(() => i / 12)).ok, true);
    assert.notDeepEqual(defaultCharacter("content"), defaultCharacter("kash"));
    assert.deepEqual(defaultCharacter("content"), defaultCharacter("content"));
  });

  test("the figure is built from the config", () => {
    const config = defaultCharacter("content");
    const spikes = parseCharacter({
      ...config,
      slots: { ...config.slots, hair: { item: "spikes", color: "#1c211e" } },
    });
    assert.equal(spikes.ok, true);
    if (!spikes.ok) return;
    const spiky = characterFigure(spikes.value);
    assert.ok(spiky.parts.filter((part) => part.shape === "cone").length >= 3);
    const bare = characterFigure({
      ...config,
      slots: { ...config.slots, hair: { item: "none", color: "#1c211e" }, top: { item: "none", color: "#ffffff" } },
    });
    assert.equal(bare.parts.some((part) => part.slot === "hair"), false);
    assert.equal(bare.parts.some((part) => part.id === "top"), false);
    const dressed = applyPalette({
      ...config,
      slots: { ...config.slots, top: { item: "tee", color: "#ffffff" } },
      palette: { ...config.palette, primary: "#2f6d4f" },
    });
    assert.equal(characterFigure(dressed).parts.find((part) => part.id === "top")?.color, "#2f6d4f");
    assert.equal(dressed.slots.hair.color, config.palette.accent);
    const large = characterFigure({ ...config, body: { ...config.body, size: "large" } }).scale;
    const small = characterFigure({ ...config, body: { ...config.body, size: "small" } }).scale;
    assert.ok(large > small);
    assert.equal(limbRotation("leg-l", { phase: 0, moving: false, seated: true })[0], -1.15);
    assert.equal(limbRotation("arm-r", { phase: 0, moving: true, seated: false })[0], 0);
    const wave = limbRotation("arm-r", { phase: 0, moving: false, seated: false, wave: true });
    assert.ok(wave[2] > 1);
    assert.deepEqual(limbRotation("arm-r", { phase: 1, moving: false, seated: false }), [0, 0, 0]);
    assert.equal(nameTagFrame("plain").filled, false);
    assert.ok(nameTagFrame("banner").width > nameTagFrame("pill").width);
  });

  test("the chibi wears clothes outside a head that is about half its height", () => {
    const config = defaultCharacter("ops");
    const hoodie = characterFigure({
      ...config,
      body: { shape: "round", size: "medium", color: "#e0b08a" },
      face: { eyes: "wide", mouth: "smile", expression: "smile" },
      slots: {
        ...config.slots,
        hair: { item: "bob", color: "#3d2314" },
        top: { item: "hoodie", color: "#2f6283" },
        bottom: { item: "pants", color: "#1c211e" },
        shoes: { item: "sneakers", color: "#f7f1e4" },
        accessory: { item: "glasses", color: "#1c211e" },
      },
    });
    const body = hoodie.parts.find((part) => part.id === "body");
    const top = hoodie.parts.find((part) => part.id === "top");
    const head = hoodie.parts.find((part) => part.id === "head");
    const eye = hoodie.parts.find((part) => part.id === "eye-l");
    const pants = hoodie.parts.find((part) => part.id === "pants-l");
    const leg = hoodie.parts.find((part) => part.id === "leg-l");
    const shoe = hoodie.parts.find((part) => part.id === "shoe-l");
    assert.ok(body && top && head && eye && pants && leg && shoe);
    if (!body || !top || !head || !eye || !pants || !leg || !shoe) return;
    const half = (part: typeof body, axis: 0 | 1 | 2) => ((part.args[axis] ?? 0) / 2) * part.scale[axis];
    assert.equal(body.shape, "box");
    assert.equal(top.shape, "box");
    assert.ok(half(top, 0) > half(body, 0));
    assert.ok(half(top, 2) > half(body, 2));
    assert.ok(top.position[2] + half(top, 2) > body.position[2] + half(body, 2));
    const headTop = head.position[1] + (head.args[0] ?? 0) * head.scale[1];
    const headDiameter = (head.args[0] ?? 0) * 2 * head.scale[1];
    assert.ok(headDiameter / headTop > 0.45);
    assert.ok(headDiameter / headTop < 0.62);
    assert.ok((eye.args[0] ?? 0) > 0.07);
    assert.ok(hoodie.parts.some((part) => part.id === "hair-back"));
    assert.ok(hoodie.parts.some((part) => part.id.startsWith("hair-front")));
    assert.ok((pants.args[0] ?? 0) / 2 > (leg.args[0] ?? 0));
    assert.ok(pants.position[1] - (pants.args[1] ?? 0) / 2 < body.position[1] - half(body, 1));
    assert.ok((shoe.args[0] ?? 0) > (leg.args[0] ?? 0) * 2);
    assert.ok(shoe.position[2] > body.position[2]);
    assert.ok(hoodie.parts.some((part) => part.id === "highlight"));
    assert.ok(hoodie.parts.some((part) => part.id === "shade"));
    const ids = hoodie.parts.map((part) => part.id);
    const at = (id: string) => ids.findIndex((item) => item === id);
    assert.ok(at("body") < at("eye-l"));
    assert.ok(at("eye-l") < at("hair-back"));
    assert.ok(at("hair-back") < at("hair-front"));
    assert.ok(at("hair-front") < at("top"));
    assert.ok(at("top") < at("bottom"));
    assert.ok(at("bottom") < at("shoe-l"));
    assert.ok(at("shoe-l") < at("glass-l"));
    assert.ok(at("glass-l") < at("highlight"));
    const tee = characterFigure({
      ...config,
      slots: { ...config.slots, top: { item: "tee", color: "#2f6283" } },
    });
    const teeTop = tee.parts.find((part) => part.id === "top");
    const teeBody = tee.parts.find((part) => part.id === "body");
    assert.ok(teeTop && teeBody && teeTop.shape === "box" && teeBody.shape === "box");
    if (!teeTop || !teeBody) return;
    assert.ok(half(teeTop, 0) > half(teeBody, 0));
    assert.ok(half(teeTop, 2) > half(teeBody, 2));
    for (const shape of ["round", "tall", "wide", "compact"] as const) {
      const shaped = characterFigure({ ...config, body: { ...config.body, shape } });
      const shapedHead = shaped.parts.find((part) => part.id === "head");
      assert.ok(shapedHead);
      if (!shapedHead) return;
      const topY = shapedHead.position[1] + (shapedHead.args[0] ?? 0) * shapedHead.scale[1];
      const diameter = (shapedHead.args[0] ?? 0) * 2 * shapedHead.scale[1];
      assert.ok(diameter / topY > 0.45, shape);
      assert.ok(diameter / topY < 0.62, shape);
    }
  });

  test("missing meshes are reported and outerwear stays on the top slot", () => {
    const config = defaultCharacter("ops");
    assert.equal(slotMeshReady("hair", "cap"), true);
    assert.equal(slotMeshReady("hair", "mohawk"), false);
    assert.equal(slotMeshReady("top", "jacket"), true);
    assert.equal(slotMeshReady("shoes", "none"), true);
    const cape = {
      ...config,
      slots: { ...config.slots, top: { item: "cape", color: "#ffffff" }, hair: { item: "mohawk", color: "#111111" } },
    };
    const gaps = missingWornParts(cape);
    assert.deepEqual(gaps.map((gap) => gap.slot), ["hair", "top"]);
    assert.equal(characterFigure(cape).parts.some((part) => part.slot === "hair" || part.slot === "top"), false);
    for (const item of INNER_TOPS) {
      if (item === "none") continue;
      assert.equal(slotMeshReady("top", item), true);
    }
    for (const item of OUTERWEAR_ITEMS) {
      if (item === "none") continue;
      assert.equal(slotMeshReady("top", item), true);
      assert.equal((INNER_TOPS as readonly string[]).includes(item), false);
    }
    const jacket = characterFigure({ ...config, slots: { ...config.slots, top: { item: "jacket", color: "#1c211e" } } });
    assert.ok(jacket.parts.some((part) => part.id === "jacket"));
  });

  test("only the character owner can write, and any signed-in person can read", async () => {
    const signedOut = characterAccess(null, "read");
    assert.equal(signedOut.ok, false);
    if (!signedOut.ok) assert.equal(characterAccessStatus(signedOut.error), 401);
    assert.equal(characterAccess(mariclare, "read", { kind: "user", id: "abby" }).ok, true);
    assert.equal(characterAccess(mariclare, "write", { kind: "user", id: "mariclare" }).ok, true);
    assert.equal(characterAccess(mariclare, "write", { kind: "user", id: "abby" }).ok, false);
    assert.equal(characterAccess(mariclare, "write", { kind: "bot", id: "content" }).ok, false);
    assert.equal(characterAccess(admin, "write", { kind: "user", id: "owner" }).ok, true);
    assert.equal(characterAccess(admin, "write", { kind: "user", id: "mariclare" }).ok, false);
    assert.equal(characterAccess(admin, "write", { kind: "bot", id: "content" }).ok, true);
    const missingBot = characterAccess(admin, "write", { kind: "bot", id: "nope" });
    assert.equal(missingBot.ok, false);
    if (!missingBot.ok) assert.equal(characterAccessStatus(missingBot.error), 404);
    assert.equal(characterAccess(manager, "write", characterSubjectForViewer(manager)!).ok, true);
    assert.deepEqual(characterSubjectForViewer(admin), { kind: "user", id: "owner" });

    const db = openTestDb();
    const list = await listBotCharacters(db);
    assert.equal(list.length, OFFICE_BOTS.length);
    assert.equal(list.every((item) => item.saved === false), true);
    const config = defaultCharacter("mariclare");
    const saved = await writeCharacter(db, { kind: "user", id: "mariclare" }, config, mariclare.email);
    assert.equal(saved.saved, true);
    assert.equal(JSON.stringify(saved).includes(mariclare.email), false);
    const again = await readCharacter(db, { kind: "user", id: "mariclare" });
    assert.deepEqual(again.config, config);
    const rows = await db.select().from(officeCharacters);
    assert.equal(rows[0]?.updatedBy, mariclare.email);
    const now = nowIso();
    await db.insert(officeCharacters).values({
      id: "user:bad",
      subjectKind: "user",
      subjectId: "bad",
      version: 1,
      document: "{",
      updatedBy: "hidden@example.com",
      createdAt: now,
      updatedAt: now,
    });
    const broken = await readCharacter(db, { kind: "user", id: "bad" });
    assert.equal(broken.saved, false);
    assert.equal(JSON.stringify(broken).includes("hidden@example.com"), false);
  });

  test("the creator page is owner-only until the flag is opened, and Worlds stays owner-only", () => {
    const previous = process.env.WORLDS_CHARACTERS;
    try {
      delete process.env.WORLDS_CHARACTERS;
      assert.equal(worldsCharacterAccess(), "owner");
      assert.equal(canOpenCharacterCreator(admin), true);
      assert.equal(canOpenCharacterCreator(mariclare), false);
      assert.equal(characterPromptVisible(mariclare, true), false);
      process.env.WORLDS_CHARACTERS = "all";
      assert.equal(canOpenCharacterCreator(mariclare), true);
      assert.equal(characterPromptVisible(mariclare, true), true);
      assert.equal(characterPromptVisible(mariclare, false), false);
      process.env.WORLDS_CHARACTERS = "off";
      assert.equal(canOpenCharacterCreator(admin), false);
    } finally {
      if (previous === undefined) delete process.env.WORLDS_CHARACTERS;
      else process.env.WORLDS_CHARACTERS = previous;
    }

    assert.equal(isBotOfficePath("/worlds/create"), true);
    assert.equal(isBotOfficePath("/portal/worlds/create", "/portal"), true);
    assert.equal(isBotOfficePath("/worlds/extra"), false);
    assert.equal(worldsReturnPath("/worlds/create"), "/worlds/create");
    assert.equal(worldsReturnPath("/worlds/create?bot=content"), null);
    assert.equal(worldsReturnPath("/worlds/extra"), null);

    const page = source("src/app/worlds/create/page.tsx");
    const office = source("src/app/worlds/page.tsx");
    const route = source("src/app/api/worlds/characters/route.ts");
    const app = source("src/components/worlds/office-app.tsx");
    const canvas = source("src/components/worlds/office-canvas.tsx");
    const creator = source("src/components/worlds/character-creator.tsx");
    const figure = source("src/components/worlds/character-figure.tsx");
    const onboarding = source("src/app/onboarding/page.tsx");
    const migration = source("drizzle/0063_office_characters.sql").toLowerCase();
    assert.match(page, /requireViewer\("\/worlds\/create"\)/);
    assert.match(page, /canOpenCharacterCreator/);
    assert.match(page, /notFound\(\)/);
    assert.match(office, /isOwner/);
    assert.match(office, /notFound\(\)/);
    assert.match(route, /currentViewer/);
    assert.match(route, /characterAccess/);
    assert.match(route, /export async function PUT/);
    assert.match(app, /Customize/);
    assert.match(app, /Your character/);
    assert.match(app, /fresh=/);
    assert.match(app, /pageshow/);
    assert.match(app, /visibilitychange/);
    assert.match(app, /LOOKS_POLL_MS/);
    assert.match(app, /office-card-links/);
    assert.ok(LOOKS_POLL_MS < OFFICE_POLL_MS);
    assert.match(creator, /savingRef/);
    assert.match(creator, /beforeunload/);
    assert.match(creator, /preventDefault/);
    assert.match(creator, /Outerwear/);
    assert.match(creator, /Accessories/);
    assert.match(creator, /Save look/);
    assert.match(creator, /The office You character wears this look/);
    assert.match(creator, /character-empty/);
    assert.match(creator, /CHARACTER_PATH/);
    const stage = source("src/components/worlds/character-stage.tsx");
    assert.match(stage, /Idle/);
    assert.match(stage, /Front/);
    assert.match(stage, /Side/);
    assert.match(stage, /Back/);
    assert.match(stage, /Profile/);
    assert.match(stage, /#e6e6e6/);
    assert.match(stage, /Compare/);
    assert.match(stage, /FashionDoll/);
    assert.match(stage, /Content creator/);
    assert.match(stage, /character-scrim/);
    assert.equal(stage.includes("humanoid.glb"), false);
    assert.equal(stage.includes("CharacterFigure"), false);
    assert.match(source("docs/worlds-creator-ux.md"), /paper doll/);
    assert.match(source("docs/worlds-creator-ux.md"), /not the creator preview/);
    const starter = defaultCharacter("owner");
    assert.equal(starter.slots.top.item, "collar");
    assert.equal(starter.slots.hair.item, "long");
    assert.equal(starter.slots.headwear.item, "none");
    assert.equal(starter.slots.bottom.item, "skirt");
    assert.equal(starter.slots.shoes.item, "boots");
    assert.equal(starter.slots.shoes.color, "#b24669");
    assert.equal(starter.slots.accessory.item, "none");
    assert.match(source("src/components/worlds/fashion-doll.tsx"), /GlamPortrait/);
    assert.match(source("src/components/worlds/glam-portrait.tsx"), /glam-front\.png/);
    assert.equal(starter.face.eyes, "wide");
    assert.equal(parseCharacter(starter).ok, true);
    assert.notDeepEqual(defaultCharacter("content"), starter);
    assert.match(creator, /sheetCoverRef/);
    assert.match(app, /next\[OWNER_ACTOR_ID\] = mineConfig/);
    assert.match(app, /It wears the look you save in the character creator/);
    assert.match(route, /CDN-Cache-Control/);
    assert.match(route, /no-store/);
    assert.match(figure, /humanoid\.glb/);
    assert.match(figure, /bindHumanoid/);
    assert.match(app, /CharacterFigure|looks/);
    assert.match(canvas, /CharacterFigure/);
    assert.match(canvas, /FashionDoll/);
    assert.match(canvas, /OWNER_ACTOR_ID/);
    assert.match(canvas, /characterFigure|defaultCharacter/);
    assert.match(onboarding, /Create your character/);
    assert.match(onboarding, /Skip for now/);
    assert.equal(migration.includes("delete "), false);
    assert.equal(migration.includes("drop "), false);
    assert.equal(migration.includes("price"), false);
    assert.equal(route.includes("api.stripe.com"), false);
    assert.equal(page.includes("api.stripe.com"), false);
  });
});
