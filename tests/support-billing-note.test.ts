import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { stripeStatusNote } from "../src/lib/stripe-billing";
import { admin, openTestDb } from "./harness";

describe("support and billing notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("an empty support list and an unknown Stripe code say nothing was sent or charged", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const support = readFileSync(path.join(process.cwd(), "src/app/support/page.tsx"), "utf8");
    assert.match(support, /No notes yet\. Nothing is emailed\./);
    assert.match(support, /Saved in the portal\. Nothing was sent\./);

    assert.equal(stripeStatusNote(undefined, false), null);
    assert.equal(stripeStatusNote("off", false), "Stripe is off. Nothing was charged.");
    assert.equal(stripeStatusNote("ready", false), "Stripe prepared a payment link. The customer is not charged until they pay it.");
    assert.equal(stripeStatusNote("mystery", false), "Stripe is off. Nothing was charged.");
    assert.equal(stripeStatusNote("mystery", true), "That payment link was not created. Nothing was charged.");

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
