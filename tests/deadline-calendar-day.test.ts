import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { deadlineFlag, uploadDueDate } from "../src/lib/deadlines";
import { shortDate } from "../src/lib/format";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("deadline calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a fake post date does not roll into another day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    for (const date of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      assert.equal(uploadDueDate(date), null);
      assert.equal(deadlineFlag(date, "draft_due", new Date("2026-03-01T16:00:00.000Z")), "none");
      assert.equal(shortDate(date), date);
    }

    assert.equal(uploadDueDate("2026-10-20"), "2026-10-17");
    assert.equal(uploadDueDate("2024-02-29"), "2024-02-26");
    assert.equal(uploadDueDate("not a date"), null);
    assert.equal(shortDate("2026-10-20"), "Oct 20");
    assert.equal(shortDate("Late October"), "Late October");

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
