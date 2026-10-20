import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { approvalEmails } from "../src/db/schema";
import { recordBrandInquiry } from "../src/lib/brand-crm";
import {
  BRAND_INQUIRY_HREF,
  BRAND_INQUIRY_LABEL,
  INQUIRY_SUBMIT_LABEL,
  publicRoster,
  rosterCountLabel,
} from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("public roster showcase", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("services link to the inquiry form, the roster stays public, and saving a brand does not email", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(rosterCountLabel(0), "0 creators on the roster.");
    assert.equal(rosterCountLabel(1), "1 creator on the roster.");
    assert.equal(rosterCountLabel(3), "3 creators on the roster.");

    const roster = await publicRoster(db);
    for (const creator of roster) assert.deepEqual(Object.keys(creator).sort(), ["id", "initials", "name"]);
    const packed = JSON.stringify(roster);
    assert.equal(packed.includes("@"), false);
    assert.equal(packed.includes("$"), false);
    assert.equal(packed.toLowerCase().includes("rate"), false);
    assert.equal(packed.includes("gmail.com"), false);

    const services = source("src/app/services/page.tsx");
    assert.match(services, /import Link from "next\/link"/);
    assert.match(services, /href=\{BRAND_INQUIRY_HREF\}/);
    assert.equal(services.includes("<a "), false);
    assert.equal(BRAND_INQUIRY_HREF, "/inquire");
    assert.equal(BRAND_INQUIRY_LABEL, "Tell us about a brand");

    const rosterPage = source("src/app/roster/page.tsx");
    assert.match(rosterPage, /rosterCountLabel\(roster\.length\)/);
    assert.match(rosterPage, /On the Momma Mari roster\./);
    assert.equal(rosterPage.includes("creator.email"), false);
    assert.equal(rosterPage.includes("gmail.com"), false);
    assert.equal(rosterPage.toLowerCase().includes("rate"), false);
    assert.equal(rosterPage.includes("kidsAges"), false);
    assert.equal(rosterPage.includes("handles"), false);

    const inquire = source("src/app/inquire/page.tsx");
    assert.match(inquire, /\{INQUIRY_SUBMIT_LABEL\}/);
    assert.equal(INQUIRY_SUBMIT_LABEL, "Save on the brand list");
    assert.equal(inquire.includes("Send to Momma Mari"), false);
    assert.match(inquire, /does not send an email/);

    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const saved = await recordBrandInquiry(db, {
      brand: "cedar soap",
      contactName: "June Buyer",
      contactEmail: "june.buyer@cedarsoap.test",
      note: "A spring post.",
    });
    assert.equal(saved.ok, true);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

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
