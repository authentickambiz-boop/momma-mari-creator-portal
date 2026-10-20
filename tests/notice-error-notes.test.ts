import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { adminNotifications } from "../src/db/schema";
import { noticeErrorCode, noticeErrorNote } from "../src/lib/notice-notes";
import { dismissNotification } from "../src/lib/onboarding";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("notice error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused dismiss keeps its sentence, and the notice stays unread", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const missing = await dismissNotification(db, "no-such-notice", { role: "admin" });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, "Notification not found.");
      assert.equal(noticeErrorCode(missing.error), "missing");
    }

    await db.insert(adminNotifications).values({
      id: "notice-test-row",
      kind: "test",
      creatorId: null,
      managerId: "manager-a",
      message: "Test notice",
      createdAt: "2026-10-20T12:00:00.000Z",
      readAt: null,
    });
    const own = await dismissNotification(db, "notice-test-row", { role: "manager", managerId: "manager-b" });
    assert.equal(own.ok, false);
    if (!own.ok) {
      assert.equal(own.error, "That notice isn't yours.");
      assert.equal(noticeErrorCode(own.error), "own");
    }
    const still = await db.select().from(adminNotifications);
    assert.equal(still.find((row) => row.id === "notice-test-row")?.readAt, null);

    assert.equal(noticeErrorNote("missing"), "Notification not found.");
    assert.equal(noticeErrorNote("own"), "That notice isn't yours.");
    assert.equal(noticeErrorNote("1"), null);
    assert.equal(noticeErrorNote("hello"), null);
    assert.equal(noticeErrorCode("Notification missing somewhere."), "1");

    const actions = source("src/app/actions.ts");
    const dismiss = actions.slice(actions.indexOf("export async function dismissNotificationAction"), actions.indexOf("export async function reviewApprovalAction"));
    assert.match(dismiss, /noticeError=\$\{noticeErrorCode\(result\.error\)\}/);
    assert.match(dismiss, /if \(!result\.ok\)/);
    const home = source("src/app/page.tsx");
    assert.match(home, /noticeErrorNote\(params\.noticeError\)/);
    assert.match(home, /That notice was not dismissed\. Nothing was changed\./);

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
