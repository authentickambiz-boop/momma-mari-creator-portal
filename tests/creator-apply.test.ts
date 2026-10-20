import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creatorApplicationAttempts, creatorApplications, creators } from "../src/db/schema";
import {
  APPLY_EMAIL_LIMIT_ERROR,
  APPLY_IP_LIMIT_ERROR,
  approveCreatorApplication,
  CREATOR_BENEFITS,
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
    assert.match(login, /params\.error === "not_allowed" \|\| params\.error === "oauth"/);
    assert.match(login, /Google sign-in didn't finish\. Try again\./);
    assert.match(login, /If you are new, apply to join Momma Mari/);
    assert.match(login, /New creator\? Apply to join Momma Mari/);
    assert.match(login, /<Link className="btn" href="\/apply">/);
    assert.match(applyPage, /What you get/);
    assert.match(applyPage, /name="website"/);
    assert.match(applyPage, /CREATOR_BENEFITS\.map/);
    assert.equal(applyPage.includes("$179"), false);
    assert.equal(applyPage.includes("$99"), false);
    assert.equal(CREATOR_BENEFITS.some((item) => item.title === "Deal representation"), true);
    assert.equal(CREATOR_BENEFITS.some((item) => item.body.includes("20%")), true);
    assert.equal(CREATOR_BENEFITS.some((item) => item.body.includes("$179")), false);
    assert.match(thanks, /Application under review/);
    assert.match(thanks, /Your application is under review/);
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
    const blankRow = (await db.select().from(creatorApplications).where(eq(creatorApplications.email, "no.rates@samplecreator.test")))[0];
    const declinedByCreator = await declineCreatorApplication(db, mariclare, blankRow?.id ?? "");
    assert.equal(declinedByCreator.ok, false);

    const declined = await declineCreatorApplication(db, admin, blankRow?.id ?? "");
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

  test("a honeypot and a burst are dropped, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const beforeApps = (await db.select().from(creatorApplications)).length;
    const beforeAttempts = (await db.select().from(creatorApplicationAttempts)).length;
    const dropped = await submitCreatorApplication(db, {
      ...application,
      email: "bot@samplecreator.test",
    }, { honeypot: "https://spam.test", ip: "203.0.113.50" });
    assert.equal(dropped.ok, true);
    assert.equal("dropped" in dropped && dropped.dropped, true);
    assert.equal((await db.select().from(creatorApplications)).length, beforeApps);
    assert.equal((await db.select().from(creatorApplicationAttempts)).length, beforeAttempts);

    const limitedEmail = "limited@samplecreator.test";
    for (let index = 0; index < 3; index += 1) {
      await db.insert(creatorApplicationAttempts).values({
        id: `email-limit-${index}`,
        email: limitedEmail,
        ip: "203.0.113.9",
        createdAt: new Date().toISOString(),
      });
    }
    const emailBlocked = await submitCreatorApplication(db, { ...application, email: limitedEmail }, { ip: "203.0.113.21" });
    assert.equal(emailBlocked.ok, false);
    if (emailBlocked.ok) return;
    assert.equal(emailBlocked.error, APPLY_EMAIL_LIMIT_ERROR);
    assert.equal((await db.select().from(creatorApplications).where(eq(creatorApplications.email, limitedEmail))).length, 0);

    for (let index = 0; index < 8; index += 1) {
      await db.insert(creatorApplicationAttempts).values({
        id: `ip-limit-${index}`,
        email: `burst-${index}@samplecreator.test`,
        ip: "203.0.113.77",
        createdAt: new Date().toISOString(),
      });
    }
    const ipBlocked = await submitCreatorApplication(db, {
      ...application,
      email: "fresh-burst@samplecreator.test",
    }, { ip: "203.0.113.77" });
    assert.equal(ipBlocked.ok, false);
    if (ipBlocked.ok) return;
    assert.equal(ipBlocked.error, APPLY_IP_LIMIT_ERROR);
    assert.equal((await db.select().from(creatorApplications).where(eq(creatorApplications.email, "fresh-burst@samplecreator.test"))).length, 0);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
    assert.equal(kosblingAfter?.contracts.length, 0);
  });
});
