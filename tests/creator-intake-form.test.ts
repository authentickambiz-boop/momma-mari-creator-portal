import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, benchCreators, creatorApplications, creatorIntake } from "../src/db/schema";
import { listCreatorApplications, submitCreatorApplication } from "../src/lib/creator-apply";
import { getCreatorIntake } from "../src/lib/creator-intake";
import {
  creatorVisibleIntakeHtml,
  INTAKE_ERRORS,
  loadResumeDraft,
  normalizeUsPhone,
  normalizeUsState,
  normalizeUsZip,
  saveIntakeDraft,
  SCREENSHOT_MAX_BYTES,
  signIntakeToken,
  submitCreatorIntake,
  validateScreenshot,
  type IntakeSubmission,
} from "../src/lib/intake-form";
import { listUnreadNotices } from "../src/lib/onboarding";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { AGE_RANGES } from "../src/lib/profile-shared";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function application(email: string, followers: string, extra: Partial<IntakeSubmission> = {}): IntakeSubmission {
  return {
    legalName: "Pat Lee",
    preferredName: "Pat",
    email,
    phone: "(980) 358-0759",
    addressLine1: "1 Sample Street",
    addressLine2: "",
    city: "Charlotte",
    addressState: "North Carolina",
    zip: "28202",
    country: "United States",
    stateOfResidence: "NC",
    platforms: [{ platform: "TikTok", handle: "@patlee", url: "https://www.tiktok.com/@patlee", followers, avgViews: "1000" }],
    niches: ["parenting"],
    goals: ["Brand deals"],
    goalsText: "I want my deals in one place.",
    kidsInContent: "yes",
    kidsCount: "1",
    kidsAges: [AGE_RANGES[0]],
    familyNotes: "Age ranges only.",
    currentRates: "private-floor-77",
    analyticsMode: "connect",
    files: [],
    consentAccuracy: true,
    ...extra,
  };
}

describe("creator intake form", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("required fields, files, routing, resume, and public HTML stay free of rates", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const old = await submitCreatorApplication(db, {
      name: "Old Form",
      email: "old.form@samplecreator.test",
      handles: "@oldform on TikTok",
      followers: "TikTok 12k",
      niche: "Mom life",
      rates: "150 per post",
      message: "I would like to join the roster.",
    });
    assert.equal(old.ok, true);

    assert.equal(normalizeUsPhone("980-358-0759"), "9803580759");
    assert.equal(normalizeUsPhone("(980) 358-0759"), "9803580759");
    assert.equal(normalizeUsPhone("123"), null);
    assert.equal(normalizeUsZip("28202"), "28202");
    assert.equal(normalizeUsZip("28202-1234"), "28202-1234");
    assert.equal(normalizeUsZip("282"), null);
    assert.equal(normalizeUsState("NC"), "NC");
    assert.equal(normalizeUsState("North Carolina"), "NC");
    assert.equal(normalizeUsState("ZZ"), null);
    assert.equal(validateScreenshot({ contentType: "image/png", byteLength: SCREENSHOT_MAX_BYTES }), null);
    assert.equal(validateScreenshot({ contentType: "image/png", byteLength: SCREENSHOT_MAX_BYTES + 1 }), INTAKE_ERRORS.size);
    assert.equal(validateScreenshot({ contentType: "application/pdf", byteLength: 1000 }), INTAKE_ERRORS.type);

    const blank = await submitCreatorIntake(db, application("blank@samplecreator.test", "", {
      legalName: " ",
      phone: "",
      addressLine1: "",
      niches: [],
      goals: [],
      kidsInContent: "",
      currentRates: "",
      analyticsMode: "",
      consentAccuracy: false,
    }));
    assert.equal(blank.ok, false);
    assert.equal((await db.select().from(creatorIntake)).length, 0);

    const badPhone = await submitCreatorIntake(db, application("bad.phone@samplecreator.test", "1000", { phone: "555" }));
    assert.equal(badPhone.ok, false);
    if (!badPhone.ok) assert.equal(badPhone.error, INTAKE_ERRORS.phone);
    const badZip = await submitCreatorIntake(db, application("bad.zip@samplecreator.test", "1000", { zip: "28" }));
    assert.equal(badZip.ok, false);
    if (!badZip.ok) assert.equal(badZip.error, INTAKE_ERRORS.zip);
    const badState = await submitCreatorIntake(db, application("bad.state@samplecreator.test", "1000", { stateOfResidence: "ZZ" }));
    assert.equal(badState.ok, false);
    if (!badState.ok) assert.equal(badState.error, INTAKE_ERRORS.state);
    const birthday = await submitCreatorIntake(db, application("birthday@samplecreator.test", "1000", { familyNotes: "Birthday 01/02/2019" }));
    assert.equal(birthday.ok, false);
    if (!birthday.ok) assert.equal(birthday.error, INTAKE_ERRORS.ages);
    const paidPull = await submitCreatorIntake(db, application("pull@samplecreator.test", "1000", { analyticsMode: "paid_pull" }));
    assert.equal(paidPull.ok, false);
    const shortShots = await submitCreatorIntake(db, application("shots@samplecreator.test", "1000", {
      analyticsMode: "screenshots",
      files: [{ platformIndex: 0, filename: "one.png", contentType: "image/png", byteLength: 1200 }],
    }));
    assert.equal(shortShots.ok, false);
    if (!shortShots.ok) assert.equal(shortShots.error, INTAKE_ERRORS.files);
    const hugeShot = await submitCreatorIntake(db, application("huge@samplecreator.test", "1000", {
      analyticsMode: "screenshots",
      files: [
        { platformIndex: 0, filename: "a.png", contentType: "image/png", byteLength: SCREENSHOT_MAX_BYTES + 1 },
        { platformIndex: 0, filename: "b.png", contentType: "image/png", byteLength: 10 },
      ],
    }));
    assert.equal(hugeShot.ok, false);
    if (!hugeShot.ok) assert.equal(hugeShot.error, INTAKE_ERRORS.size);

    const bands: { followers: string; band: string }[] = [
      { followers: "500", band: "0-1k" },
      { followers: "5000", band: "1k-10k" },
      { followers: "20000", band: "10k-50k" },
      { followers: "80000", band: "50k-100k" },
    ];
    for (const item of bands) {
      const saved = await submitCreatorIntake(db, application(`band.${item.band}@samplecreator.test`, item.followers));
      assert.equal(saved.ok, true);
      if (saved.ok && !("dropped" in saved)) {
        assert.equal(saved.route, "curriculum");
        assert.equal(saved.band, item.band);
      }
    }
    const sign = await submitCreatorIntake(db, application("signed.path@samplecreator.test", "100000", {
      analyticsMode: "screenshots",
      files: [
        { platformIndex: 0, filename: "a.jpg", contentType: "image/jpeg", byteLength: 2000 },
        { platformIndex: 0, filename: "b.webp", contentType: "image/webp", byteLength: 2000 },
      ],
    }));
    assert.equal(sign.ok, true);
    if (sign.ok && !("dropped" in sign)) assert.equal(sign.route, "sign");
    const signRow = (await db.select().from(creatorApplications).where(eq(creatorApplications.email, "signed.path@samplecreator.test")))[0];
    assert.equal(signRow?.status, "pending");
    const smallRow = (await db.select().from(creatorApplications).where(eq(creatorApplications.email, "band.0-1k@samplecreator.test")))[0];
    assert.equal(smallRow?.status, "curriculum");

    const benchSmall = await submitCreatorIntake(db, application("bench.small@samplecreator.test", "1500"), { channel: "bench" });
    assert.equal(benchSmall.ok, true);
    assert.equal((await db.select().from(benchCreators)).some((row) => row.email === "bench.small@samplecreator.test"), true);
    const benchLarge = await submitCreatorIntake(db, application("bench.large@samplecreator.test", "250000"), { channel: "bench" });
    assert.equal(benchLarge.ok, true);
    assert.equal((await db.select().from(benchCreators)).some((row) => row.email === "bench.large@samplecreator.test"), false);
    const largeRow = (await db.select().from(creatorApplications).where(eq(creatorApplications.email, "bench.large@samplecreator.test")))[0];
    assert.equal(largeRow?.status, "pending");

    const draft = await saveIntakeDraft(db, application("resume@samplecreator.test", "1200"));
    assert.equal(draft.ok, true);
    if (draft.ok && "token" in draft && draft.token) {
      const resume = await loadResumeDraft(db, draft.token);
      assert.equal(resume?.values.email, "resume@samplecreator.test");
      assert.equal(resume?.values.currentRates, "");
      assert.equal(resume?.hasRates, true);
      assert.equal(JSON.stringify(resume).includes("private-floor-77"), false);
      const tampered = `${draft.token}x`;
      assert.equal(await loadResumeDraft(db, tampered), null);
      assert.equal(signIntakeToken("missing", "resume@samplecreator.test") === draft.token, false);
    }

    const ownerIntake = await getCreatorIntake(db, admin, sign.ok && !("dropped" in sign) ? sign.id : "");
    assert.equal(ownerIntake?.currentRates, "private-floor-77");
    const creatorIntakeView = await getCreatorIntake(db, mariclare, ownerIntake?.id ?? "");
    assert.equal("currentRates" in (creatorIntakeView ?? {}), false);
    const html = creatorVisibleIntakeHtml({ ...(ownerIntake ?? creatorIntakeView!), currentRates: "private-floor-77" });
    assert.match(html, /Pat Lee/);
    assert.equal(html.includes("private-floor-77"), false);
    assert.equal(html.includes("statedRates"), false);
    assert.equal(/\$\s?\d/.test(html), false);
    assert.equal((await listCreatorApplications(db, mariclare)).length, 0);
    const ownerApps = await listCreatorApplications(db, admin);
    const legacy = ownerApps.find((row) => row.email === "old.form@samplecreator.test");
    assert.equal(legacy?.handles, "@oldform on TikTok");
    assert.equal(legacy?.followers, "TikTok 12k");
    assert.equal(legacy?.niche, "Mom life");
    assert.equal(legacy?.rates, "150 per post");
    assert.equal(legacy?.message, "I would like to join the roster.");
    const notices = await listUnreadNotices(db);
    assert.equal(notices.some((note) => note.message.includes("private-floor-77")), false);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

    const applyPage = source("src/app/apply/page.tsx");
    const form = source("src/components/intake-form.tsx");
    const curriculum = source("src/app/curriculum/page.tsx");
    const bench = source("src/app/bench/join/page.tsx");
    const dashboard = source("src/app/dashboard/page.tsx");
    assert.match(applyPage, /What you get/);
    assert.match(applyPage, /name="website"/);
    assert.match(applyPage, /CREATOR_BENEFITS\.map/);
    assert.match(applyPage, /PrivacyNotice|IntakeForm/);
    assert.equal(applyPage.includes("{params.error}"), false);
    assert.equal(applyPage.includes("$179"), false);
    assert.equal(applyPage.includes("$99"), false);
    assert.match(form, /Only Kamron sees this/);
    assert.match(form, /name="website"/);
    assert.equal(form.includes("paid_pull"), false);
    assert.equal(form.includes("Analytics pull"), false);
    assert.equal(/\$\s?\d/.test(form), false);
    assert.match(curriculum, /CURRICULUM_BANDS\.map/);
    assert.match(curriculum, /band\.label/);
    const thresholds = source("src/lib/signing-thresholds.ts");
    assert.match(thresholds, /0 to 1k followers/);
    assert.match(thresholds, /1k to 10k followers/);
    assert.match(thresholds, /10k to 50k followers/);
    assert.match(thresholds, /50k to 100k followers/);
    assert.match(thresholds, /100_000/);
    assert.equal(/\$\s?\d/.test(curriculum), false);
    assert.match(bench, /benchErrorNote\(params\.benchError\)/);
    assert.match(bench, /You are on the bench\. There is no fee\./);
    assert.match(bench, /index: false/);
    assert.equal(bench.includes("{params.benchError}"), false);
    assert.match(dashboard, /application\.handles/);
    assert.match(dashboard, /application\.rates/);
    assert.match(dashboard, /application\.message/);
    assert.equal(isPublicMarketingPath("/curriculum", ""), true);
    const lib = source("src/lib/intake-form.ts");
    assert.equal(lib.includes("api.stripe.com"), false);
    assert.equal(lib.includes("createApprovalEmail"), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingBefore?.stageEvents?.length);
  });
});
