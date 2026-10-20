import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { campaigns } from "../src/db/schema";
import { createBrandOffer, offerContactEmail } from "../src/lib/brand-offers";
import { budgetFilterText } from "../src/lib/deal-rules";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function page(name: string) {
  return readFileSync(path.join(process.cwd(), "src/app", name), "utf8");
}

describe("owner board polish", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("a bad contact email is refused, a blank one is stored empty, and the pages say nothing is emailed", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.deepEqual(offerContactEmail("  "), { ok: true, email: null });
    assert.deepEqual(offerContactEmail(null), { ok: true, email: null });
    assert.deepEqual(offerContactEmail(" Nina@harbor.example "), { ok: true, email: "Nina@harbor.example" });
    const nope = offerContactEmail("nope");
    const invalid = offerContactEmail("june@example.invalid");
    const spaced = offerContactEmail("june @example.com");
    assert.equal(nope.ok, false);
    assert.equal(invalid.ok, false);
    assert.equal(spaced.ok, false);
    if (!nope.ok) assert.equal(nope.error, "Use a real contact email, or leave it blank. Nothing was emailed.");

    const refused = await createBrandOffer(db, admin, {
      brand: "Cedar",
      contactName: "June",
      contactEmail: "june@example.invalid",
      deliverables: ["1 TikTok"],
      platforms: ["TikTok"],
      budgets: [{ creatorId: "mariclare", amountCents: 10000 }],
    });
    assert.equal(refused.ok, false);
    assert.equal((await db.select().from(campaigns).where(eq(campaigns.brand, "Cedar"))).length, 0);

    const saved = await createBrandOffer(db, admin, {
      brand: "Harbor",
      contactName: "Nina",
      contactEmail: " Nina@harbor.example ",
      deliverables: ["1 TikTok"],
      platforms: ["TikTok"],
      budgets: [{ creatorId: "mariclare", amountCents: 10000 }],
    });
    assert.equal(saved.ok, true);
    const harbor = await db.select().from(campaigns).where(eq(campaigns.brand, "Harbor"));
    assert.equal(harbor.length, 1);
    assert.equal(harbor[0]?.contactEmail, "Nina@harbor.example");

    const blank = await createBrandOffer(db, admin, {
      brand: "Blank Mail",
      contactName: "Ada",
      contactEmail: " ",
      deliverables: ["1 TikTok"],
      platforms: ["TikTok"],
      budgets: [{ creatorId: "mariclare", amountCents: 10000 }],
    });
    assert.equal(blank.ok, true);
    assert.equal((await db.select().from(campaigns).where(eq(campaigns.brand, "Blank Mail")))[0]?.contactEmail, null);

    assert.deepEqual(budgetFilterText("  "), { ok: true, text: "" });
    assert.deepEqual(budgetFilterText("$500"), { ok: true, text: "$500" });
    const junk = budgetFilterText("abc");
    assert.equal(junk.ok, false);
    if (!junk.ok) assert.equal(junk.error, "Enter the budget in dollars, like 500.");
    assert.equal(budgetFilterText("-1").ok, false);

    const filter = page("campaign-actions.ts");
    assert.match(filter, /budgetFilterText\(min\)/);
    assert.match(filter, /campaignError/);
    const dashboard = page("dashboard/page.tsx");
    assert.match(dashboard, /growthError/);
    assert.match(dashboard, /Saved\. Nothing was paid or billed\./);
    const offers = page("offers/page.tsx");
    assert.match(offers, /Save offer/);
    assert.match(offers, /This adds the offer to her portal\. Nothing is emailed\./);
    assert.equal(offers.includes("Send offer"), false);
    const gifts = page("gifts/page.tsx");
    assert.match(gifts, /Use a date like 2026-11-20\./);

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
