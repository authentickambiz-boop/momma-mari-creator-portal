import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creatorOnboarding, creators } from "../src/db/schema";
import { finishErrorCode, finishErrorNote } from "../src/lib/finish-notes";
import { finishOnboarding } from "../src/lib/onboarding";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("finish profile notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused profile finish keeps its sentence, and nothing is saved", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const onboardingBefore = await db.select().from(creatorOnboarding).where(eq(creatorOnboarding.creatorId, "mariclare"));
    const kidsBefore = (await db.select().from(creators).where(eq(creators.id, "mariclare")))[0]?.kidsAges ?? null;

    const refused = await finishOnboarding(db, "mariclare", {
      botName: "",
      niche: "",
      contentStyle: "",
      rates: "",
      platforms: [],
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(finishErrorCode(refused.error) === "1", false);
      assert.equal(finishErrorNote(finishErrorCode(refused.error)), refused.error);
    }

    assert.equal(finishErrorCode("Choose how brand email should work, then connect it."), "connect");
    assert.equal(finishErrorCode("Enter the address you want Momma Mari to host."), "host");
    assert.equal(finishErrorCode("Name your bot, and add a niche, content style, rates, and at least one platform."), "profile");
    assert.equal(finishErrorCode("nope"), "1");
    assert.equal(finishErrorNote("1"), null);
    assert.equal(finishErrorNote("hello"), null);
    assert.equal(finishErrorNote(undefined), null);
    assert.equal(finishErrorNote("connect"), "Choose how brand email should work, then connect it.");
    assert.equal(finishErrorNote("host"), "Enter the address you want Momma Mari to host.");
    assert.equal(finishErrorNote("profile"), "Name your bot, and add a niche, content style, rates, and at least one platform.");

    const actions = source("src/app/actions.ts");
    const finish = actions.slice(actions.indexOf("export async function finishOnboardingAction"), actions.indexOf("export async function dismissNotificationAction"));
    assert.match(finish, /error=\$\{finishErrorCode\(result\.error\)\}/);
    assert.equal(finish.includes("error=1"), false);
    const page = source("src/app/onboarding/page.tsx");
    assert.match(page, /finishErrorNote\(params\.error\)/);
    assert.match(page, /That profile was not saved\. Add a niche, a content style, rates, and at least one platform\./);
    const wizard = source("src/components/onboarding-wizard.tsx");
    assert.match(wizard, /finishErrorNote\(error\)/);
    assert.match(wizard, /That profile was not saved\. Add a niche, a content style, rates, and at least one platform\./);

    const onboardingAfter = await db.select().from(creatorOnboarding).where(eq(creatorOnboarding.creatorId, "mariclare"));
    assert.equal(onboardingAfter.length, onboardingBefore.length);
    assert.equal(onboardingAfter[0]?.finishedAt ?? null, onboardingBefore[0]?.finishedAt ?? null);
    const kidsAfter = (await db.select().from(creators).where(eq(creators.id, "mariclare")))[0]?.kidsAges ?? null;
    assert.equal(kidsAfter, kidsBefore);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
  });
});
