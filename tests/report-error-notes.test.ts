import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { approvalEmails } from "../src/db/schema";
import { getDealForViewer } from "../src/lib/queries";
import { buildMonthlyReport, draftMonthlyReport, reportErrorCode, reportErrorNote } from "../src/lib/report";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("report error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a report that cannot be queued keeps its sentence, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    const month = await buildMonthlyReport(db, "mariclare", "2026-13");
    assert.equal(month.ok, false);
    if (!month.ok) {
      assert.equal(month.error, "Month has to look like 2026-10.");
      assert.equal(reportErrorCode(month.error), "month");
      assert.equal(reportErrorNote("month"), month.error);
    }

    const needsDeal = await draftMonthlyReport(db, {
      creatorId: "abby",
      month: "2026-10",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(needsDeal.ok, false);
    if (!needsDeal.ok) {
      assert.equal(needsDeal.error, "She needs a deal on the books before this email can be queued.");
      assert.equal(reportErrorCode(needsDeal.error), "deal");
    }
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

    assert.equal(reportErrorCode("This month's report is already in the approval queue. Nothing was sent."), "queued");
    assert.equal(reportErrorCode("Only Kamron can draft the monthly report."), "owner");
    assert.equal(reportErrorNote("1"), null);
    assert.equal(reportErrorNote("hello world"), null);

    const actions = source("src/app/actions.ts");
    const draft = actions.slice(actions.indexOf("export async function draftReportAction"), actions.indexOf("function referralBack"));
    assert.match(draft, /reportError=\$\{reportErrorCode\(result\.error\)\}/);
    assert.equal(draft.includes('status === 409 ? "queued"'), false);
    const page = source("src/app/report/page.tsx");
    assert.match(page, /reportErrorNote\(reportCode\)/);
    assert.match(page, /That report was not queued\. Nothing was sent\./);
    assert.match(page, /built && !built\.ok \? built\.error/);
    assert.equal(page.includes("{params.reportError}"), false);

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
