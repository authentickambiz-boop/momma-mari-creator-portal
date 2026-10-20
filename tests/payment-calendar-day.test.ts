import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { payments } from "../src/db/schema";
import { upsertPayment } from "../src/lib/bot-api";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("payment calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a payment date that looks like a day has to be a real day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    for (const name of ["dueDate", "landedDate", "payoutApprovedOn", "paidOutDate"] as const) {
      for (const date of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
        const refused = await upsertPayment(db, { dealId: "vev", [name]: date });
        assert.equal(refused.status, 400);
        assert.equal("error" in refused.body && refused.body.error, `${name} must be a real day like 2026-11-20.`);
      }
    }

    const untouched = await db.select().from(payments).where(eq(payments.dealId, "vev"));
    assert.equal(untouched.length, 1);
    assert.equal(untouched[0]?.dueDate, null);
    assert.equal(untouched[0]?.landedDate, null);

    const saved = await upsertPayment(db, {
      dealId: "vev",
      dueDate: "Late October",
      landedDate: "2026-10-20",
      payoutApprovedOn: "2024-02-29",
      paidOutDate: null,
    });
    assert.equal(saved.status, 200);
    const rows = await db.select().from(payments).where(eq(payments.dealId, "vev"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.dueDate, "Late October");
    assert.equal(rows[0]?.landedDate, "2026-10-20");
    assert.equal(rows[0]?.payoutApprovedOn, "2024-02-29");
    assert.equal(rows[0]?.paidOutDate, null);

    const kept = await upsertPayment(db, { dealId: "vev", landedDate: "2026-02-31" });
    assert.equal(kept.status, 400);
    const after = await db.select().from(payments).where(eq(payments.dealId, "vev"));
    assert.equal(after[0]?.landedDate, "2026-10-20");
    assert.equal(after[0]?.dueDate, "Late October");

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
