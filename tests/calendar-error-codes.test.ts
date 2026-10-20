import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { calendarErrorCode, calendarErrorNote } from "../src/lib/calendar-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("calendar error codes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a calendar link cannot invent its own error wording, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(calendarErrorCode("Use a date like 2026-10-21."), "date");
    assert.equal(calendarErrorCode("You can't change due dates."), "dates");
    assert.equal(calendarErrorCode("You can only connect your own calendar."), "own");
    assert.equal(calendarErrorCode("anything else"), "1");
    assert.equal(calendarErrorNote("date"), "Use a date like 2026-10-21.");
    assert.equal(calendarErrorNote("1"), "That was not saved.");
    assert.equal(calendarErrorNote("hello world"), "That was not saved.");
    assert.equal(calendarErrorNote("<script>alert(1)</script>"), "That was not saved.");
    assert.equal(calendarErrorNote(undefined), null);

    const page = source("src/app/calendar/page.tsx");
    assert.match(page, /calendarErrorNote\(params\.calendarError\)/);
    assert.match(page, /Saved\. Nothing was emailed\./);
    assert.equal(page.includes("{params.calendarError}"), false);
    const action = source("src/app/calendar-actions.ts");
    assert.match(action, /calendarError=\$\{calendarErrorCode\(result\.error\)\}/);
    assert.equal(action.includes("calendarError=${encodeURIComponent"), false);

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
