import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creatorIntake, creatorPlatforms, creatorTasks } from "../src/db/schema";
import { listCreatorOpenTasks } from "../src/lib/creator-tasks";
import { getCreatorIntake, listCreatorIntake } from "../src/lib/creator-intake";
import { paymentsEnabled } from "../src/lib/payments";
import { profileIntakeMissing, saveProfileIntake } from "../src/lib/profile-intake";
import { getDealForViewer } from "../src/lib/queries";
import { creatorStartPath } from "../src/lib/questionnaire";
import { abby, admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const handles = [
  { platform: "TikTok", handle: "@theofficialtheriots", url: "https://www.tiktok.com/@theofficialtheriots", followers: "78800" },
  { platform: "Instagram", handle: "@theofficialtheriots", url: "https://www.instagram.com/theofficialtheriots", followers: "1728" },
];

describe("complete your profile", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("Abby can save contract details on her intake row, and other creators cannot see them", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    assert.equal(paymentsEnabled(), false);

    const open = await listCreatorOpenTasks(db, "abby");
    assert.equal(open.some((task) => task.id === "profile-intake-abby" && task.title === "Complete your profile"), true);
    assert.equal(JSON.stringify(open).includes("$"), false);
    assert.equal(await profileIntakeMissing(db, "abby"), true);
    assert.equal(await creatorStartPath(db, abby), "/profile/intake");
    assert.equal(await creatorStartPath(db, admin), "/");

    const missing = await saveProfileIntake(db, abby, {
      legalName: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      addressState: "",
      zip: "",
      country: "",
      handles: [],
    });
    assert.equal(missing.ok, false);
    assert.equal((await db.select().from(creatorIntake).where(eq(creatorIntake.creatorId, "abby"))).length, 0);

    const badPhone = await saveProfileIntake(db, abby, {
      legalName: "Abby Theriot",
      phone: "555",
      addressLine1: "1 Sample Street",
      addressLine2: "",
      city: "Cordell",
      addressState: "Oklahoma",
      zip: "73632",
      country: "United States",
      handles,
    });
    assert.equal(badPhone.ok, false);
    const badZip = await saveProfileIntake(db, abby, {
      legalName: "Abby Theriot",
      phone: "980-358-0199",
      addressLine1: "1 Sample Street",
      addressLine2: "",
      city: "Cordell",
      addressState: "OK",
      zip: "736",
      country: "USA",
      handles,
    });
    assert.equal(badZip.ok, false);

    const saved = await saveProfileIntake(db, abby, {
      legalName: "Abby Theriot",
      phone: "(405) 555-0134",
      addressLine1: "1 Sample Street",
      addressLine2: "Apt 2",
      city: "Cordell",
      addressState: "Oklahoma",
      zip: "73632-1234",
      country: "United States",
      handles,
    });
    assert.equal(saved.ok, true);
    const row = (await db.select().from(creatorIntake).where(eq(creatorIntake.creatorId, "abby")))[0];
    assert.equal(row?.legalName, "Abby Theriot");
    assert.equal(row?.phone, "4055550134");
    assert.equal(row?.addressLine1, "1 Sample Street");
    assert.equal(row?.addressLine2, "Apt 2");
    assert.equal(row?.city, "Cordell");
    assert.equal(row?.addressState, "OK");
    assert.equal(row?.stateOfResidence, "OK");
    assert.equal(row?.zip, "73632-1234");
    assert.equal(row?.country, "United States");
    assert.equal(row?.email, "theofficialtheriots@gmail.com");
    assert.equal(row?.status, "submitted");
    assert.equal(row?.currentRates, null);
    const platforms = (await db.select().from(creatorPlatforms)).filter((item) => item.intakeId === row?.id);
    assert.equal(platforms.length, 2);
    assert.equal(platforms.some((item) => item.platform === "TikTok" && item.handle === "@theofficialtheriots" && item.followers === 78800), true);

    const updated = await saveProfileIntake(db, abby, {
      legalName: "Abigail Theriot",
      phone: "4055550134",
      addressLine1: "1 Sample Street",
      addressLine2: "",
      city: "Cordell",
      addressState: "OK",
      zip: "73632",
      country: "US",
      handles: [handles[0]],
    });
    assert.equal(updated.ok, true);
    const again = await db.select().from(creatorIntake).where(eq(creatorIntake.creatorId, "abby"));
    assert.equal(again.length, 1);
    assert.equal(again[0]?.legalName, "Abigail Theriot");
    const replaced = (await db.select().from(creatorPlatforms)).filter((item) => item.intakeId === again[0]?.id);
    assert.equal(replaced.length, 1);

    assert.equal((await saveProfileIntake(db, mariclare, {
      legalName: "Mari Clare",
      phone: "9805550100",
      addressLine1: "2 Other Street",
      addressLine2: "",
      city: "Charlotte",
      addressState: "NC",
      zip: "28202",
      country: "United States",
      handles: [{ platform: "TikTok", handle: "@mariclare", url: "", followers: "" }],
    })).ok, true);
    assert.equal((await db.select().from(creatorIntake).where(eq(creatorIntake.creatorId, "abby")))[0]?.legalName, "Abigail Theriot");
    const hidden = await listCreatorIntake(db, mariclare);
    assert.equal(hidden.some((item) => item.legalName === "Abigail Theriot"), false);
    const owner = await getCreatorIntake(db, admin, again[0]?.id ?? "");
    assert.equal(owner?.legalName, "Abigail Theriot");
    assert.equal(owner?.currentRates ?? null, null);

    assert.equal((await listCreatorOpenTasks(db, "abby")).some((task) => task.id === "profile-intake-abby"), false);
    assert.equal((await db.select().from(creatorTasks).where(eq(creatorTasks.id, "profile-intake-abby")))[0]?.status, "done");
    assert.equal(await profileIntakeMissing(db, "abby"), false);
    assert.notEqual(await creatorStartPath(db, abby), "/profile/intake");
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

    const page = source("src/app/profile/intake/page.tsx");
    const profile = source("src/app/profile/page.tsx");
    const todos = source("src/components/creator-todos.tsx");
    assert.match(page, /Complete your profile/);
    assert.match(page, /name="legalName"/);
    assert.match(page, /name="phone"/);
    assert.match(page, /name="addressLine1"/);
    assert.match(page, /profileIntakeErrorNote\(params\.intakeError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.equal(page.includes("{params.intakeError}"), false);
    assert.equal(page.includes("statedRates"), false);
    assert.equal(page.includes("currentRates"), false);
    assert.equal(/\$\s?\d/.test(page), false);
    assert.match(profile, /href="\/profile\/intake"/);
    assert.match(todos, /href="\/profile\/intake"/);
    assert.match(source("src/lib/questionnaire.ts"), /profileIntakeMissing/);
    assert.match(source("src/app/api/auth/callback/route.ts"), /creatorStartPath/);
    assert.match(source("src/app/login/page.tsx"), /creatorStartPath/);
    assert.match(source("src/lib/current-user.ts"), /profileIntakeMissing/);
    assert.match(source("src/app/profile/intake/page.tsx"), /allowIncompleteProfile: true/);
    assert.equal(source("src/lib/profile-intake.ts").includes("createApprovalEmail"), false);

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
