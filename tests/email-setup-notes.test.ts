import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creators } from "../src/db/schema";
import { emailSetupErrorCode, emailSetupErrorNote } from "../src/lib/email-setup-notes";
import { saveEmailSetup } from "../src/lib/onboarding";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("email setup notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused email choice keeps its sentence, and nothing is charged", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const mariclareBefore = (await db.select().from(creators).where(eq(creators.id, "mariclare")))[0];

    const blank = await saveEmailSetup(db, "mariclare", "hosted", "   ");
    assert.equal(blank.ok, false);
    if (!blank.ok) {
      assert.equal(blank.error, "Enter the name you want before @mommamari.com.");
      assert.equal(emailSetupErrorCode(blank.error), "name");
    }

    const missing = await saveEmailSetup(db, "missing-creator", "business");
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, "Creator not found.");
      assert.equal(emailSetupErrorCode(missing.error), "missing");
    }

    assert.equal(emailSetupErrorCode("nope"), "1");
    assert.equal(emailSetupErrorNote("1"), null);
    assert.equal(emailSetupErrorNote("hello"), null);
    assert.equal(emailSetupErrorNote(undefined), null);
    assert.equal(emailSetupErrorNote("name"), "Enter the name you want before @mommamari.com, like abby.");
    assert.equal(emailSetupErrorNote("choice"), "Pick business email, the email you already use, or a hosted address. Nothing was changed.");
    assert.equal(emailSetupErrorNote("missing"), "Creator not found.");

    const actions = source("src/app/actions.ts");
    const choose = actions.slice(actions.indexOf("export async function chooseEmailSetupAction"), actions.indexOf("export async function finishOnboardingAction"));
    assert.match(choose, /emailError=choice/);
    assert.match(choose, /emailError=\$\{emailSetupErrorCode\(result\.error\)\}/);
    assert.equal(choose.includes("emailError=1"), false);
    const form = source("src/components/email-setup-form.tsx");
    assert.match(form, /emailSetupErrorNote\(error\)/);
    assert.match(form, /That email choice was not saved\. Nothing was charged\./);
    assert.match(form, /Nothing is charged from this page\./);
    const page = source("src/app/onboarding/page.tsx");
    assert.match(page, /EmailSetupForm error=\{params\.emailError \?\? null\}/);

    const mariclareAfter = (await db.select().from(creators).where(eq(creators.id, "mariclare")))[0];
    assert.equal(mariclareAfter?.emailSetup ?? null, mariclareBefore?.emailSetup ?? null);
    assert.equal(mariclareAfter?.hostedEmailAddress ?? null, mariclareBefore?.hostedEmailAddress ?? null);

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
