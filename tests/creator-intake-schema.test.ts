import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creatorApplications, creatorIntake, creatorPlatforms } from "../src/db/schema";
import { getCreatorIntake, listBotIntake, listCreatorIntake, redactIntakeForBot } from "../src/lib/creator-intake";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const SECRET_RATES = "private-floor-1800-per-post";

describe("creator intake schema", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("0048 applies on a database that already has applications, and those rows stay put", () => {
    const sqlite = new DatabaseSync(":memory:");
    const dir = path.join(process.cwd(), "drizzle");
    const earlier = readdirSync(dir).filter((file) => file.endsWith(".sql") && file < "0048_creator_intake.sql").sort();
    for (const file of earlier) sqlite.exec(source(path.join("drizzle", file)));
    sqlite.prepare(`INSERT INTO creator_applications (
      id, name, email, handles, followers, niche, rates, message, status, creator_id, invited_at, created_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "app-existing",
      "Pat Lee",
      "pat.lee@samplecreator.test",
      "@patlee on TikTok",
      "TikTok 12k",
      "Mom life",
      "150 per post",
      "I would like to join the roster.",
      "pending",
      null,
      null,
      "2026-10-01T00:00:00.000Z",
      null,
    );
    const beforeRow = sqlite.prepare("SELECT * FROM creator_applications WHERE id = ?").get("app-existing");
    const migration = source("drizzle/0048_creator_intake.sql");
    assert.equal(migration.toLowerCase().includes("drop "), false);
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.toLowerCase().includes("update "), false);
    assert.equal(migration.includes("KOSBLING"), true);
    sqlite.exec(migration);
    const afterRow = sqlite.prepare("SELECT * FROM creator_applications WHERE id = ?").get("app-existing");
    assert.deepEqual(afterRow, beforeRow);
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('creator_intake', 'creator_platforms', 'intake_files')").all() as { name: string }[];
    assert.deepEqual(tables.map((row) => row.name).sort(), ["creator_intake", "creator_platforms", "intake_files"]);
  });

  test("current rates stay off non-admin and bot payloads, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const appsBefore = await db.select().from(creatorApplications);

    await db.insert(creatorIntake).values({
      id: "intake-secret",
      applicationId: null,
      creatorId: "mariclare",
      legalName: "Mari Clare",
      preferredName: "MariClare",
      email: "mmaclamroc@gmail.com",
      phone: "9805550100",
      addressLine1: "1 Sample Street",
      addressLine2: null,
      city: "Charlotte",
      addressState: "NC",
      zip: "28202",
      country: "United States",
      stateOfResidence: "NC",
      nichesJson: JSON.stringify(["parenting"]),
      goalsJson: JSON.stringify(["Brand deals"]),
      goalsText: "Keep the work in one place.",
      currentRates: SECRET_RATES,
      kidsInContent: true,
      kidsCount: 1,
      kidsAges: "3–5",
      familyNotes: null,
      analyticsMode: "connect",
      consentJson: JSON.stringify({ accuracy: true }),
      status: "submitted",
      submittedAt: "2026-10-21T00:00:00.000Z",
      createdAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
    });
    await db.insert(creatorPlatforms).values({
      id: "platform-secret",
      intakeId: "intake-secret",
      platform: "TikTok",
      handle: "@mariclare",
      url: "https://www.tiktok.com/@mariclare",
      followers: 2300000,
      avgViews: 100000,
      capturedAt: "2026-10-21T00:00:00.000Z",
      source: "self",
      createdAt: "2026-10-21T00:00:00.000Z",
    });

    const creatorView = await getCreatorIntake(db, mariclare, "intake-secret");
    assert.equal(creatorView?.legalName, "Mari Clare");
    assert.equal("currentRates" in (creatorView ?? {}), false);
    assert.equal(JSON.stringify(creatorView).includes(SECRET_RATES), false);
    assert.equal(creatorView?.platforms[0]?.followers, 2300000);

    const ownerView = await getCreatorIntake(db, admin, "intake-secret");
    assert.equal(ownerView?.currentRates, SECRET_RATES);

    const listed = await listCreatorIntake(db, mariclare);
    assert.equal(listed.some((row) => JSON.stringify(row).includes(SECRET_RATES)), false);
    const ownerList = await listCreatorIntake(db, admin);
    assert.equal(ownerList.some((row) => row.currentRates === SECRET_RATES), true);

    const bot = await listBotIntake(db);
    assert.equal(JSON.stringify(bot).includes(SECRET_RATES), false);
    assert.equal(JSON.stringify(bot).includes("currentRates"), false);
    assert.equal(JSON.stringify(bot).includes("current_rates"), false);
    const redacted = redactIntakeForBot({
      id: "x",
      currentRates: SECRET_RATES,
      current_rates: SECRET_RATES,
      rates: SECRET_RATES,
      minDealCents: 180000,
      nested: { quoteCents: 99, handle: "@kept" },
    });
    assert.deepEqual(redacted, { id: "x", nested: { handle: "@kept" } });

    const appsAfter = await db.select().from(creatorApplications);
    assert.equal(appsAfter.length, appsBefore.length);
    for (const beforeRow of appsBefore) {
      const afterRow = appsAfter.find((row) => row.id === beforeRow.id);
      assert.deepEqual(afterRow, beforeRow);
    }
    const stored = (await db.select().from(creatorApplications).where(eq(creatorApplications.email, "pat.lee@samplecreator.test")))[0];
    assert.equal(stored, undefined);

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
