import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { referralSettings, referrals } from "../src/db/schema";
import { getDealForViewer } from "../src/lib/queries";
import { getReferralPerk, recordReferral, referralErrorCode, referralErrorNote, setReferralPerk } from "../src/lib/referrals";
import { abby, admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("referral error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused referral keeps its sentence, and nothing is paid", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const perkBefore = await getReferralPerk(db);
    const rowsBefore = await db.select().from(referrals).where(eq(referrals.referrerCreatorId, "mariclare"));

    const own = await recordReferral(db, {
      referrerCreatorId: "abby",
      referredName: "Pat Sample",
      referredEmail: "pat@samplecreator.test",
      actorEmail: mariclare.email,
      actorRole: "creator",
      actorCreatorId: mariclare.creatorId,
    });
    assert.equal(own.ok, false);
    if (!own.ok) {
      assert.equal(own.error, "You can only add a referral for yourself.");
      assert.equal(referralErrorCode(own.error), "own");
    }

    const badEmail = await recordReferral(db, {
      referrerCreatorId: "mariclare",
      referredName: "Pat Sample",
      referredEmail: "pat@samplecreator.invalid",
      actorEmail: mariclare.email,
      actorRole: "creator",
      actorCreatorId: mariclare.creatorId,
    });
    assert.equal(badEmail.ok, false);
    if (!badEmail.ok) {
      assert.equal(badEmail.error, "That email can't be saved.");
      assert.equal(referralErrorCode(badEmail.error), "email");
    }

    const blank = await recordReferral(db, {
      referrerCreatorId: "mariclare",
      referredName: "   ",
      referredEmail: "pat@samplecreator.test",
      actorEmail: admin.email,
      actorRole: "admin",
      actorCreatorId: null,
    });
    assert.equal(blank.ok, false);
    if (!blank.ok) {
      assert.equal(blank.error, "Add the person's name.");
      assert.equal(referralErrorCode(blank.error), "name");
    }

    const manager = await recordReferral(db, {
      referrerCreatorId: "mariclare",
      referredName: "Pat Sample",
      referredEmail: "pat@samplecreator.test",
      actorEmail: "riley.list@gmail.com",
      actorRole: "manager",
      actorCreatorId: null,
    });
    assert.equal(manager.ok, false);
    if (!manager.ok) {
      assert.equal(manager.error, "Referrals are for the creator and Kamron.");
      assert.equal(referralErrorCode(manager.error), "who");
    }

    const perk = await setReferralPerk(db, { amountCents: 2500, actorRole: "creator" });
    assert.equal(perk.ok, false);
    if (!perk.ok) {
      assert.equal(perk.error, "Only Kamron can set the perk amount.");
      assert.equal(referralErrorCode(perk.error), "perk");
    }

    const amount = await setReferralPerk(db, { amountCents: Number.NaN, actorRole: "admin" });
    assert.equal(amount.ok, false);
    if (!amount.ok) {
      assert.equal(amount.error, "The perk amount has to be a whole number of cents, or blank.");
      assert.equal(referralErrorCode(amount.error), "amount");
    }

    assert.equal(referralErrorCode("nope"), "1");
    assert.equal(referralErrorNote("1"), null);
    assert.equal(referralErrorNote("hello"), null);
    assert.equal(referralErrorNote(undefined), null);
    assert.equal(referralErrorNote("email"), "That email can't be saved.");
    assert.equal(referralErrorNote("amount"), "The perk amount has to be a whole number of cents, or blank.");

    const actions = source("src/app/actions.ts");
    const perkAction = actions.slice(actions.indexOf("export async function setReferralPerkAction"), actions.indexOf("export async function recordReferralAction"));
    assert.match(perkAction, /referralError=\$\{referralErrorCode\(result\.error\)\}/);
    assert.equal(perkAction.includes("referralError=perk"), false);
    const record = actions.slice(actions.indexOf("export async function recordReferralAction"), actions.indexOf("export async function logoutAction"));
    assert.match(record, /referralError=\$\{referralErrorCode\(result\.error\)\}/);
    assert.equal(record.includes("referralError=1"), false);

    const page = source("src/app/referrals/page.tsx");
    assert.match(page, /referralErrorNote\(params\.referralError\)/);
    assert.match(page, /That referral was not saved\. Nothing was paid\./);
    assert.equal(page.includes(">{params.referralError}<"), false);

    const rowsAfter = await db.select().from(referrals).where(eq(referrals.referrerCreatorId, "mariclare"));
    assert.equal(rowsAfter.length, rowsBefore.length);
    const settings = await db.select().from(referralSettings);
    assert.equal(settings.length, 0);
    assert.equal(await getReferralPerk(db), perkBefore);

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
