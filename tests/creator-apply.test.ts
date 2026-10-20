import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creatorApplications, creators } from "../src/db/schema";
import {
  approveCreatorApplication,
  declineCreatorApplication,
  futurePaidSignup,
  listCreatorApplications,
  submitCreatorApplication,
} from "../src/lib/creator-apply";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { listUnreadNotices } from "../src/lib/onboarding";
import { getDealForViewer, resolveLogin } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const application = {
  name: "Pat Lee",
  email: "pat.lee@samplecreator.test",
  handles: "@patlee on TikTok",
  followers: "TikTok 12k",
  niche: "Mom life",
  rates: "150 per post",
  message: "I would like to join the roster.",
};

describe("creator apply", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a public application waits for the owner, approval creates the account, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const creatorsBefore = (await db.select().from(creators)).length;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    const paid = futurePaidSignup();
    assert.equal(paid.wired, false);
    assert.equal(paid.charged, false);
    const lib = source("src/lib/creator-apply.ts");
    assert.match(lib, /Stripe stays off/);
    assert.equal(lib.includes("STRIPE_ENABLED"), false);
    assert.equal(lib.includes("STRIPE_SECRET"), false);
    assert.equal(lib.includes("api.stripe.com"), false);
    assert.equal(lib.includes("createApprovalEmail"), false);

    const migration = source("drizzle/0039_creator_applications.sql");
    assert.equal(migration.toLowerCase().includes("update deals"), false);
    assert.equal(migration.includes("KOSBLING"), true);

    assert.equal(isPublicMarketingPath("/apply", ""), true);
    assert.equal(isPublicMarketingPath("/apply/thanks", ""), true);
    assert.equal(isPublicMarketingPath("/portal/apply", "/portal"), true);
    const applyPage = source("src/app/apply/page.tsx");
    const thanks = source("src/app/apply/thanks/page.tsx");
    const login = source("src/app/login/page.tsx");
    const dashboard = source("src/app/dashboard/page.tsx");
    assert.equal(applyPage.includes("{params.error}"), false);
    assert.match(thanks, /Thanks, your application will be reviewed soon\./);
    assert.equal(thanks.includes('name="rates"'), false);
    assert.match(login, /That Google account isn't on the Momma Mari creator list/);
    assert.match(login, /params\.error === "not_allowed"/);
    assert.match(login, /href="\/apply"/);
    assert.match(dashboard, /Applications/);
    assert.match(dashboard, /Stripe stays off/);
    assert.match(dashboard, /Saved\. Nothing was paid or billed\./);

    const invalid = await submitCreatorApplication(db, { ...application, email: "pat@example.invalid" });
    assert.equal(invalid.ok, false);
    assert.equal((await db.select().from(creatorApplications)).length, 0);

    const missing = await submitCreatorApplication(db, { ...application, name: "  " });
    assert.equal(missing.ok, false);
    const rosterEmail = await submitCreatorApplication(db, { ...application, email: "mmaclamroc@gmail.com" });
    assert.equal(rosterEmail.ok, false);
    assert.equal((await db.select().from(creatorApplications)).length, 0);

    const saved = await submitCreatorApplication(db, application);
    assert.equal(saved.ok, true);
    const blankRates = await submitCreatorApplication(db, {
      ...application,
      email: "no.rates@samplecreator.test",
      rates: "   ",
    });
    assert.equal(blankRates.ok, true);
    const duplicate = await submitCreatorApplication(db, application);
    assert.equal(duplicate.ok, false);
    const rows = await db.select().from(creatorApplications);
    assert.equal(rows.length, 2);
    const pending = rows.find((row) => row.email === "pat.lee@samplecreator.test");
    assert.equal(pending?.status, "pending");
    assert.equal(pending?.rates, "150 per post");
    assert.equal(rows.find((row) => row.email === "no.rates@samplecreator.test")?.rates, null);
    assert.equal((await db.select().from(creators)).length, creatorsBefore);

    const notices = await listUnreadNotices(db);
    assert.equal(notices.some((note) => note.kind === "creator_application" && note.message.includes("Nothing was emailed.")), true);
    assert.equal(notices.some((note) => note.message.toLowerCase().includes("150 per post")), false);

    const hidden = await listCreatorApplications(db, mariclare);
    assert.equal(hidden.length, 0);
    const ownerList = await listCreatorApplications(db, admin);
    assert.equal(ownerList.filter((row) => row.status === "pending").length, 2);

    const refused = await approveCreatorApplication(db, mariclare, pending?.id ?? "");
    assert.equal(refused.ok, false);
    assert.equal((await db.select().from(creators)).length, creatorsBefore);
    const declinedByCreator = await declineCreatorApplication(db, mariclare, blankRates.ok ? blankRates.id : "");
    assert.equal(declinedByCreator.ok, false);

    const declined = await declineCreatorApplication(db, admin, blankRates.ok ? blankRates.id : "");
    assert.equal(declined.ok, true);
    const declinedRow = (await db.select().from(creatorApplications).where(eq(creatorApplications.email, "no.rates@samplecreator.test")))[0];
    assert.equal(declinedRow?.status, "declined");
    assert.equal(declinedRow?.creatorId, null);
    assert.equal(declinedRow?.invitedAt, null);
    assert.equal((await db.select().from(creators)).length, creatorsBefore);
    const again = await approveCreatorApplication(db, admin, declinedRow?.id ?? "");
    assert.equal(again.ok, false);

    const approved = await approveCreatorApplication(db, admin, pending?.id ?? "");
    assert.equal(approved.ok, true);
    const second = await approveCreatorApplication(db, admin, pending?.id ?? "");
    assert.equal(second.ok, false);
    const people = await db.select().from(creators);
    assert.equal(people.length, creatorsBefore + 1);
    const created = people.find((row) => row.email === "pat.lee@samplecreator.test");
    assert.equal(created?.name, "Pat Lee");
    assert.equal(created?.handles, "@patlee on TikTok");
    assert.equal(created?.isSeed, false);
    assert.equal(created?.signerIsMinor, false);
    assert.equal(created?.kidsAges, null);
    assert.equal(created?.tiktokStatus, "disconnected");
    const approvedRow = (await db.select().from(creatorApplications).where(eq(creatorApplications.email, "pat.lee@samplecreator.test")))[0];
    assert.equal(approvedRow?.status, "approved");
    assert.equal(approvedRow?.creatorId, created?.id);
    assert.equal(Boolean(approvedRow?.invitedAt), true);
    const signedIn = await resolveLogin(db, "Pat.Lee@samplecreator.test");
    assert.equal(signedIn.ok, true);
    if (signedIn.ok) {
      assert.equal(signedIn.viewer.role, "creator");
      assert.equal(signedIn.viewer.creatorId, created?.id);
    }
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    assert.equal((await db.select().from(approvalEmails)).some((row) => row.toEmail.includes("samplecreator.test")), false);

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
