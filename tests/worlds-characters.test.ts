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
  characterSubjectForViewer,
  defaultCharacter,
  limbRotation,
  nameTagFrame,
  parseCharacter,
  randomCharacter,
  worldsCharacterAccess,
} from "../src/lib/worlds/character";
import { listBotCharacters, readCharacter, writeCharacter } from "../src/lib/worlds/character-store";
import { OFFICE_BOTS } from "../src/lib/worlds/office-catalog";
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
    const large = characterFigure({ ...config, body: { ...config.body, size: "large" } }).scale;
    const small = characterFigure({ ...config, body: { ...config.body, size: "small" } }).scale;
    assert.ok(large > small);
    assert.equal(limbRotation("leg-l", { phase: 0, moving: false, seated: true })[0], -1.15);
    assert.equal(limbRotation("arm-r", { phase: 0, moving: true, seated: false })[0], 0);
    assert.equal(nameTagFrame("plain").filled, false);
    assert.ok(nameTagFrame("banner").width > nameTagFrame("pill").width);
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
    assert.match(app, /CharacterFigure|looks/);
    assert.match(canvas, /CharacterFigure/);
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
