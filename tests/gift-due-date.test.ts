import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { giftedOffers } from "../src/db/schema";
import { GIFTED_TERMS_VERSION } from "../src/config/gifted-terms";
import {
  applyForGiftedOffer,
  approveGiftedApplicant,
  createGiftedOffer,
  giftDueOn,
  markGiftedShipped,
} from "../src/lib/gifted";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("gift due dates", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a fake calendar day is refused, and apply then ship still works", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(giftDueOn("2026-02-31"), null);
    assert.equal(giftDueOn("2026-13-40"), null);
    assert.equal(giftDueOn("2026-02-29"), null);
    assert.equal(giftDueOn("tomorrow"), null);
    assert.equal(giftDueOn("2024-02-29"), "2024-02-29");
    assert.equal(giftDueOn(" 2026-11-20 "), "2026-11-20");

    const before = (await db.select().from(giftedOffers)).length;
    for (const dueOn of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      const refused = await createGiftedOffer(db, {
        actorRole: "admin",
        actorName: "Kamron",
        brand: "Bad Date Co",
        product: "Bad bar",
        photos: "https://example.com/bad.jpg",
        deliverable: "1 TikTok",
        dueOn,
        retailValueCents: 2400,
      });
      assert.equal(refused.ok, false);
      if (!refused.ok) {
        assert.equal(refused.status, 400);
        assert.equal(refused.error, "Use a due date like 2026-11-20.");
      }
    }
    assert.equal((await db.select().from(giftedOffers)).length, before);

    const posted = await createGiftedOffer(db, {
      actorRole: "admin",
      actorName: "Kamron",
      brand: "Ship Soap",
      product: "Ship bar",
      photos: "https://example.com/ship.jpg",
      deliverable: "1 TikTok",
      dueOn: "2026-11-20",
      retailValueCents: 2400,
    });
    assert.equal(posted.ok, true);
    if (!posted.ok) return;
    const applied = await applyForGiftedOffer(db, {
      offerId: posted.id,
      creatorId: "mariclare",
      acceptTerms: true,
      termsVersion: GIFTED_TERMS_VERSION,
    });
    assert.equal(applied.ok, true);
    if (!applied.ok) return;
    assert.equal(applied.status, "applied");
    const approved = await approveGiftedApplicant(db, { actorRole: "admin", applicationId: applied.id });
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    assert.equal(approved.status, "approved");
    const shipped = await markGiftedShipped(db, { actorRole: "admin", applicationId: applied.id });
    assert.equal(shipped.ok, true);
    if (!shipped.ok) return;
    assert.equal(shipped.status, "shipped");

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
