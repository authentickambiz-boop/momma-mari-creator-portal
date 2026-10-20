import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals, payments } from "../src/db/schema";
import { markPayment, paymentErrorCode } from "../src/lib/fulfillment";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("payment step notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a payment refusal keeps its own sentence, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const vevPayBefore = (await db.select().from(payments).where(eq(payments.dealId, "vev")))[0];

    const early = await markPayment(db, {
      dealId: "kosbling",
      paymentStatus: "brand_invoiced",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(early.ok, false);
    if (!early.ok) {
      assert.equal(early.error, "Post the video before invoicing the brand. Nothing was changed.");
      assert.equal(paymentErrorCode(early.error), "early");
    }

    const step = await markPayment(db, {
      dealId: "kosbling",
      paymentStatus: "nope",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(step.ok, false);
    if (!step.ok) {
      assert.equal(step.error, "That is not a payment step.");
      assert.equal(paymentErrorCode(step.error), "step");
    }

    await db.update(deals).set({ workflowStage: "paid" }).where(eq(deals.id, "vev"));
    const paid = await markPayment(db, {
      dealId: "vev",
      paymentStatus: "brand_invoiced",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(paid.ok, false);
    if (!paid.ok) {
      assert.equal(paid.error, "This deal is already paid. Nothing was changed.");
      assert.equal(paymentErrorCode(paid.error), "paid");
      assert.notEqual(paymentErrorCode(paid.error), "early");
    }
    const vevPay = (await db.select().from(payments).where(eq(payments.dealId, "vev")))[0];
    assert.equal(vevPay?.paymentStatus ?? null, vevPayBefore?.paymentStatus ?? null);

    assert.equal(paymentErrorCode("Mark the brand invoice before marking the brand paid."), "invoice");
    assert.equal(paymentErrorCode("Mark the brand paid before marking the creator payout pending."), "brand");
    assert.equal(paymentErrorCode("Mark the creator payout pending before marking the creator paid."), "payout");
    assert.equal(paymentErrorCode("That payment step is already marked."), "marked");
    assert.equal(paymentErrorCode("hello world"), "1");

    const actions = source("src/app/actions.ts");
    const paymentAction = actions.slice(actions.indexOf("export async function markPaymentAction"), actions.indexOf("export async function devLoginAction"));
    assert.match(paymentAction, /paymentError=\$\{paymentErrorCode\(result\.error\)\}/);
    assert.equal(paymentAction.includes("status === 409"), false);
    const board = source("src/components/deal-board.tsx");
    assert.match(board, /This deal is already paid\. Nothing was changed\./);
    assert.match(board, /Mark the brand invoice before marking the brand paid\./);
    assert.match(board, /That payment step was not saved\. Nothing was charged\./);

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
