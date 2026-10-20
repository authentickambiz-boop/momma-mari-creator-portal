import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { brandCrmEntries } from "../src/db/schema";
import { recordBrandInquiry } from "../src/lib/brand-crm";
import { inquiryErrorCode, inquiryErrorNote } from "../src/lib/inquiry-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("inquiry error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused brand inquiry keeps its sentence, and nothing is emailed", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const rowsBefore = await db.select().from(brandCrmEntries);

    const blank = await recordBrandInquiry(db, {
      brand: "   ",
      contactEmail: "june.buyer@cedarsoap.test",
    });
    assert.equal(blank.ok, false);
    if (!blank.ok) {
      assert.equal(blank.error, "Name the brand.");
      assert.equal(inquiryErrorCode(blank.error), "name");
    }

    const email = await recordBrandInquiry(db, {
      brand: "Cedar Soap",
      contactEmail: "june.buyer@cedarsoap.invalid",
    });
    assert.equal(email.ok, false);
    if (!email.ok) {
      assert.equal(email.error, "Use a real work email.");
      assert.equal(inquiryErrorCode(email.error), "email");
    }

    assert.equal(inquiryErrorCode("nope"), "1");
    assert.equal(inquiryErrorNote("1"), null);
    assert.equal(inquiryErrorNote("hello"), null);
    assert.equal(inquiryErrorNote(undefined), null);
    assert.equal(inquiryErrorNote("name"), "Name the brand.");
    assert.equal(inquiryErrorNote("email"), "Use a real work email.");

    const action = source("src/app/inquire-actions.ts");
    assert.match(action, /error=\$\{inquiryErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("error=1"), false);
    const page = source("src/app/inquire/page.tsx");
    assert.match(page, /inquiryErrorNote\(params\.error\)/);
    assert.match(page, /Add the brand name and a real work email, then try again\. Nothing was emailed\./);
    assert.match(page, /Nothing was emailed\./);
    assert.equal(page.includes("{params.error}"), false);

    const rowsAfter = await db.select().from(brandCrmEntries);
    assert.equal(rowsAfter.length, rowsBefore.length);

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
