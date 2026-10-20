import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { shipments } from "../src/db/schema";
import { confirmProductReceived, saveShipment } from "../src/lib/fulfillment";
import { productErrorCode, productErrorNote } from "../src/lib/product-notes";
import { getDealForViewer } from "../src/lib/queries";
import { abby, admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("product error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused tracking save or product confirm keeps its sentence, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const shipmentsBefore = await db.select().from(shipments).where(eq(shipments.dealId, "kosbling"));

    const blank = await saveShipment(db, {
      dealId: "kosbling",
      carrier: "   ",
      trackingNumber: "",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(blank.ok, false);
    if (!blank.ok) {
      assert.equal(blank.error, "Carrier and tracking number are required.");
      assert.equal(productErrorCode(blank.error), "carrier");
    }

    const creator = await saveShipment(db, {
      dealId: "kosbling",
      carrier: "UPS",
      trackingNumber: "1Z",
      actorEmail: mariclare.email,
      actorRole: "creator",
    });
    assert.equal(creator.ok, false);
    if (!creator.ok) {
      assert.equal(creator.error, "You can't add tracking.");
      assert.equal(productErrorCode(creator.error), "tracking");
    }

    const missing = await saveShipment(db, {
      dealId: "missing-deal",
      carrier: "UPS",
      trackingNumber: "1Z",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, "Deal not found.");
      assert.equal(productErrorCode(missing.error), "missing");
    }

    const past = await confirmProductReceived(db, {
      dealId: "kosbling",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(past.ok, false);
    if (!past.ok) {
      assert.equal(past.error, "This deal is already past the product. Nothing was changed.");
      assert.equal(productErrorCode(past.error), "past");
    }

    const other = await confirmProductReceived(db, {
      dealId: "kosbling",
      actorEmail: abby.email,
      actorRole: "creator",
      creatorId: abby.creatorId,
    });
    assert.equal(other.ok, false);
    if (!other.ok) {
      assert.equal(other.error, "You can't update this deal.");
      assert.equal(productErrorCode(other.error), "own");
    }

    assert.equal(productErrorCode("That creator isn't on your list."), "list");
    assert.equal(productErrorCode("You can't move this deal."), "move");
    assert.equal(productErrorCode("nope"), "1");
    assert.equal(productErrorNote("1"), null);
    assert.equal(productErrorNote("hello"), null);
    assert.equal(productErrorNote(undefined), null);
    assert.equal(productErrorNote("past"), "This deal is already past the product. Nothing was changed.");
    assert.equal(productErrorNote("carrier"), "Carrier and tracking number are required.");

    const actions = source("src/app/actions.ts");
    const save = actions.slice(actions.indexOf("export async function saveShipmentAction"), actions.indexOf("export async function confirmProductAction"));
    assert.match(save, /productError=\$\{productErrorCode\(result\.error\)\}/);
    assert.equal(save.includes("productError=1"), false);
    const confirm = actions.slice(actions.indexOf("export async function confirmProductAction"), actions.indexOf("export async function submitLivePostsAction"));
    assert.match(confirm, /productError=\$\{productErrorCode\(result\.error\)\}/);
    assert.equal(confirm.includes("status === 409"), false);

    const board = source("src/components/deal-board.tsx");
    assert.match(board, /productErrorNote\(productError\)/);
    assert.match(board, /That tracking was not saved\. Nothing was changed\./);

    const shipmentsAfter = await db.select().from(shipments).where(eq(shipments.dealId, "kosbling"));
    assert.equal(shipmentsAfter.length, shipmentsBefore.length);
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
