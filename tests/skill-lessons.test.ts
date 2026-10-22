import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { deals, skillLessons } from "../src/db/schema";
import { paymentsEnabled } from "../src/lib/payments-config";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import { getDealForViewer } from "../src/lib/queries";
import { SKILL_TOPICS, lessonLeaksPrivateRates, listSkillLessons, saveSkillLesson } from "../src/lib/skill-lessons";
import { admin, abby, mariclare, openTestDb } from "./harness";

const manager = {
  email: "riley.manager@gmail.com",
  role: "manager" as const,
  creatorId: null,
  name: "Riley",
  assignedCreatorIds: ["mariclare"],
};

describe("skill lessons", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("creators see general lessons plus their own, and staff can edit them", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const dealCount = (await db.select().from(deals)).length;
    assert.equal(paymentsEnabled(), false);
    assert.deepEqual(SKILL_TOPICS.map((topic) => topic.id), ["hooks", "filming", "editing", "posting", "growth", "ugc"]);
    assert.equal(lessonLeaksPrivateRates("Her minimum is private"), true);
    assert.equal(lessonLeaksPrivateRates("Film by the window"), false);

    const seeded = await db.select().from(skillLessons);
    assert.equal(seeded.length, 6);
    assert.equal(seeded.every((row) => row.creatorId == null), true);
    const seedText = seeded.map((row) => `${row.title} ${row.body}`).join(" ");
    assert.equal(seedText.toLowerCase().includes("minimum"), false);
    assert.equal(seedText.includes("$"), false);
    const sql = readFileSync(path.join(process.cwd(), "drizzle/0054_skill_lessons.sql"), "utf8");
    assert.equal(sql.toLowerCase().includes("delete "), false);
    assert.equal(sql.toLowerCase().includes("minimum"), false);

    const mari = await listSkillLessons(db, mariclare, "mariclare");
    assert.equal(mari.canWrite, false);
    assert.equal(mari.lessons.length, 6);
    assert.equal(mari.lessons.every((lesson) => lesson.audienceLabel === "For everyone"), true);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.label === "How Momma Mari works"), true);
    assert.equal(visiblePortalTabs(manager).some((tab) => tab.href === "/learn"), true);

    const blocked = await saveSkillLesson(db, mariclare, {
      topic: "hooks",
      title: "A private note",
      body: "Creators do not write the library.",
      creatorId: null,
    });
    assert.equal(blocked.ok, false);

    const leaked = await saveSkillLesson(db, admin, {
      topic: "hooks",
      title: "Rates",
      body: "Do not put a minimum on this page.",
      creatorId: null,
    });
    assert.equal(leaked.ok, false);
    if (!leaked.ok) assert.equal(leaked.code, "private");
    assert.equal((await db.select().from(skillLessons)).length, 6);

    const forMari = await saveSkillLesson(db, manager, {
      topic: "filming",
      title: "A note for MariClare",
      body: "Try the window in the kitchen for the next brand clip. Keep the product in your hand for a full second.",
      creatorId: "mariclare",
    });
    assert.equal(forMari.ok, true);
    if (!forMari.ok) return;

    const forEveryone = await saveSkillLesson(db, manager, {
      topic: "editing",
      title: "Leave the room tone out",
      body: "If the fridge hum is louder than your voice, cut that stretch. The point of the clip should be easy to hear.",
      creatorId: null,
    });
    assert.equal(forEveryone.ok, true);

    const wrongCreator = await saveSkillLesson(db, manager, {
      topic: "growth",
      title: "Only for Abby",
      body: "This manager does not cover Abby, so this lesson should not save.",
      creatorId: "abby",
    });
    assert.equal(wrongCreator.ok, false);
    if (!wrongCreator.ok) assert.equal(wrongCreator.code, "creator");

    const forAbby = await saveSkillLesson(db, admin, {
      topic: "ugc",
      title: "A note for Abby",
      body: "Hold the product still at the end so the label can be read. Send the clean file with the caption.",
      creatorId: "abby",
    });
    assert.equal(forAbby.ok, true);
    if (!forAbby.ok) return;

    const mariAfter = await listSkillLessons(db, mariclare, "mariclare");
    assert.equal(mariAfter.lessons.some((lesson) => lesson.title === "A note for MariClare"), true);
    assert.equal(mariAfter.lessons.some((lesson) => lesson.title === "Leave the room tone out"), true);
    assert.equal(mariAfter.lessons.some((lesson) => lesson.title === "A note for Abby"), false);
    const mariNote = mariAfter.lessons.find((lesson) => lesson.id === forMari.id);
    assert.equal(mariNote?.audienceLabel, "For MariClare");

    const abbyView = await listSkillLessons(db, abby, "abby");
    assert.equal(abbyView.lessons.some((lesson) => lesson.title === "A note for Abby"), true);
    assert.equal(abbyView.lessons.some((lesson) => lesson.title === "A note for MariClare"), false);
    assert.equal(abbyView.lessons.some((lesson) => lesson.title === "Leave the room tone out"), true);

    const managerAll = await listSkillLessons(db, manager, "all");
    assert.equal(managerAll.canWrite, true);
    assert.equal(managerAll.lessons.some((lesson) => lesson.title === "A note for Abby"), false);
    assert.equal(managerAll.lessons.some((lesson) => lesson.title === "A note for MariClare"), true);

    const focused = await listSkillLessons(db, admin, "mariclare");
    assert.equal(focused.lessons.some((lesson) => lesson.title === "A note for Abby"), false);
    const everyone = await listSkillLessons(db, admin, "all");
    assert.equal(everyone.lessons.some((lesson) => lesson.title === "A note for Abby"), true);

    const edited = await saveSkillLesson(db, admin, {
      id: "starter-hooks",
      topic: "hooks",
      title: "Open on the moment",
      body: "Show the result before you explain it.\n\nThen say the sentence you would text a friend.",
      creatorId: null,
    });
    assert.equal(edited.ok, true);
    const hooks = (await listSkillLessons(db, mariclare, "mariclare")).lessons.find((lesson) => lesson.id === "starter-hooks");
    assert.equal(hooks?.title, "Open on the moment");
    assert.equal(hooks?.paragraphs.length, 2);

    const stolen = await saveSkillLesson(db, manager, {
      id: forAbby.id,
      topic: "ugc",
      title: "Moved",
      body: "A manager who does not cover Abby cannot rewrite her lesson.",
      creatorId: "mariclare",
    });
    assert.equal(stolen.ok, false);
    const abbyStill = (await db.select().from(skillLessons)).find((row) => row.id === forAbby.id);
    assert.equal(abbyStill?.title, "A note for Abby");
    assert.equal(abbyStill?.creatorId, "abby");

    const page = readFileSync(path.join(process.cwd(), "src/app/learn/page.tsx"), "utf8");
    const library = readFileSync(path.join(process.cwd(), "src/lib/skill-lessons.ts"), "utf8");
    assert.equal(page.toLowerCase().includes("minimum"), false);
    assert.equal(/\$\d/.test(page), false);
    assert.equal(library.toLowerCase().includes("delete("), false);
    assert.equal(library.includes("stripe"), false);
    assert.equal(library.includes("docusign"), false);
    assert.equal((await db.select().from(deals)).length, dealCount);
    assert.equal((await getDealForViewer(db, admin, "kosbling"))?.brand, kosblingBefore?.brand);
    assert.equal((await getDealForViewer(db, admin, "kosbling"))?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal((await db.select().from(skillLessons)).some((row) => row.id === "starter-filming"), true);
  });
});
