import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { campaigns } from "../src/db/schema";
import { createBrandOffer } from "../src/lib/brand-offers";
import { saveCampaign } from "../src/lib/campaigns";
import { offerErrorCode } from "../src/lib/offer-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

const campaign = {
  brand: "Date Soap",
  name: "Date Soap push",
  budgetCents: 50000,
  niches: ["parenting"],
  platforms: ["TikTok"],
  deliverables: ["TikTok"],
  slots: 1,
};

describe("campaign calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a campaign or offer date that looks like a day has to be a real day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const before = (await db.select().from(campaigns)).length;

    for (const date of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      const refused = await saveCampaign(db, admin, { ...campaign, startsOn: date, endsOn: "2026-11-30" });
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.equal(refused.error, "Use a date like 2026-11-01.");
      const offer = await createBrandOffer(db, admin, {
        brand: "Date Soap offer",
        contactName: "Ada Brand",
        contactEmail: "ada@datesoap.example",
        deliverables: ["TikTok"],
        platforms: ["TikTok"],
        budgets: [{ creatorId: "abby", amountCents: 50000 }],
        startsOn: "2026-11-01",
        endsOn: date,
      });
      assert.equal(offer.ok, false);
      if (!offer.ok) {
        assert.equal(offer.error, "Use a date like 2026-11-01.");
        assert.equal(offerErrorCode(offer.error), "date");
      }
    }
    assert.equal((await db.select().from(campaigns)).length, before);

    const saved = await saveCampaign(db, admin, { ...campaign, startsOn: "November", endsOn: "2024-02-29" });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const row = await db.select().from(campaigns).where(eq(campaigns.id, saved.id));
    assert.equal(row[0]?.startsOn, "November");
    assert.equal(row[0]?.endsOn, "2024-02-29");

    const kept = await saveCampaign(db, admin, { ...campaign, startsOn: "2026-11-01", endsOn: "2026-02-31" }, saved.id);
    assert.equal(kept.ok, false);
    const still = await db.select().from(campaigns).where(eq(campaigns.id, saved.id));
    assert.equal(still[0]?.startsOn, "November");
    assert.equal(still[0]?.endsOn, "2024-02-29");

    const offer = await createBrandOffer(db, admin, {
      brand: "Date Soap offer",
      contactName: "Ada Brand",
      contactEmail: "ada@datesoap.example",
      deliverables: ["TikTok"],
      platforms: ["TikTok"],
      budgets: [{ creatorId: "abby", amountCents: 50000 }],
      startsOn: " 2026-11-01 ",
      endsOn: "",
    });
    assert.equal(offer.ok, true);
    if (!offer.ok) return;
    const offered = await db.select().from(campaigns).where(eq(campaigns.id, offer.id));
    assert.equal(offered[0]?.startsOn, "2026-11-01");
    assert.equal(offered[0]?.endsOn, null);

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
