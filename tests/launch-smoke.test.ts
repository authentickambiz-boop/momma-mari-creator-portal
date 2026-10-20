import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creatorProfiles, creators, deals } from "../src/db/schema";
import { addBrandCrmEntry, listBrandCrm, recordBrandInquiry } from "../src/lib/brand-crm";
import { createBrandOffer, offerBudgetsFromRaw, OFFER_BUDGET_ERROR } from "../src/lib/brand-offers";
import { rulesFor } from "../src/lib/deal-rules";
import { questionnaireFieldPatch, saveQuestionnaireStep } from "../src/lib/questionnaire";
import { getDealForViewer } from "../src/lib/queries";
import type { Viewer } from "../src/lib/types";
import { admin, openTestDb } from "./harness";

describe("launch smoke", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("an inquiry can take a response and a contact, and a bad offer budget is refused", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    const rejected = await recordBrandInquiry(db, {
      brand: "Nope Brand",
      contactEmail: "buyer@example.invalid",
      note: "skip",
    });
    assert.equal(rejected.ok, false);
    const saved = await recordBrandInquiry(db, {
      brand: "sample outdoor co",
      contactName: "Pat Buyer",
      contactEmail: "Pat.Buyer@SampleOutdoor.test",
      note: "Looking for a fall post.",
    });
    assert.equal(saved.ok, true);

    const unknown = await addBrandCrmEntry(db, {
      brand: "Not On The List",
      kind: "response",
      response: "interested",
      note: "no",
      actorRole: "admin",
      actorName: "Kamron",
    });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.error, "That brand is not on a deal yet.");

    const manager = await addBrandCrmEntry(db, {
      brand: "Sample Outdoor Co",
      kind: "response",
      response: "interested",
      actorRole: "manager",
      actorName: "Riley",
    });
    assert.equal(manager.ok, false);
    if (!manager.ok) assert.equal(manager.error, "Only an owner can update the brand list.");

    const response = await addBrandCrmEntry(db, {
      brand: "Sample Outdoor Co",
      kind: "response",
      response: "interested",
      note: "Will follow up next week.",
      actorRole: "admin",
      actorName: "Kamron",
    });
    assert.equal(response.ok, true);
    const contact = await addBrandCrmEntry(db, {
      brand: "Sample Outdoor Co",
      kind: "contact",
      contactName: "Pat Buyer",
      contactEmail: "pat.buyer@sampleoutdoor.test",
      note: "Work email from the inquiry.",
      actorRole: "admin",
      actorName: "Kamron",
    });
    assert.equal(contact.ok, true);

    const list = await listBrandCrm(db, admin);
    assert.equal(list.ok, true);
    if (!list.ok) return;
    const card = list.brands.find((item) => item.key === "sample outdoor co");
    assert.equal(card?.deals.length, 0);
    assert.equal(card?.responses.some((row) => row.decision === "interested" && row.note === "Will follow up next week."), true);
    assert.equal(card?.contacts.some((row) => row.source === "inquiry" && row.email === "pat.buyer@sampleoutdoor.test"), true);
    assert.equal(card?.contacts.some((row) => row.source === "added" && row.email === "pat.buyer@sampleoutdoor.test"), true);

    const offer = await createBrandOffer(db, admin, {
      brand: "Smoke Offer Co",
      contactName: "Nia Cole",
      contactEmail: "nia@smokeoffer.test",
      deliverables: ["TikTok video"],
      platforms: ["TikTok"],
      budgets: [{ creatorId: "mariclare", amountCents: 8000 }],
    });
    assert.equal(offer.ok, true);
    const offerResponse = await addBrandCrmEntry(db, {
      brand: "Smoke Offer Co",
      kind: "response",
      response: "negotiating",
      note: "Asked for November.",
      actorRole: "admin",
      actorName: "Kamron",
    });
    assert.equal(offerResponse.ok, true);
    assert.equal((await db.select().from(deals).where(eq(deals.brand, "Smoke Offer Co"))).length, 0);

    const blankAndBad = offerBudgetsFromRaw([
      { creatorId: "mariclare", raw: "" },
      { creatorId: "abby", raw: "twelve" },
    ]);
    assert.equal(blankAndBad.ok, false);
    if (!blankAndBad.ok) assert.equal(blankAndBad.error, OFFER_BUDGET_ERROR);
    const kept = offerBudgetsFromRaw([
      { creatorId: "mariclare", raw: "  " },
      { creatorId: "abby", raw: "$1,200" },
    ]);
    assert.equal(kept.ok, true);
    if (kept.ok) assert.deepEqual(kept.budgets, [{ creatorId: "abby", amountCents: 120000 }]);

    const viewer: Viewer = {
      email: "smoke.rates@gmail.com",
      name: "Smoke Rates",
      role: "creator",
      creatorId: "smoke-rates",
    };
    await db.insert(creators).values({
      id: "smoke-rates",
      name: "Smoke Rates",
      email: "smoke.rates@gmail.com",
      handles: null,
      kidsAges: null,
      initials: "SR",
      tiktokStatus: "disconnected",
      instagramStatus: "disconnected",
      facebookStatus: "disconnected",
      youtubeStatus: "disconnected",
      emailStatus: "disconnected",
      isSeed: false,
      createdAt: "2026-10-20T07:00:00.000Z",
    });
    const rates = questionnaireFieldPatch(
      "rates",
      (name) => (name === "rateYouTube integration" ? "400" : ""),
      () => [],
    );
    assert.equal(rates.rates?.["YouTube integration"], "400");
    assert.equal(rates.rates?.TikTok, "");
    const rateSaved = await saveQuestionnaireStep(db, viewer, { step: "rates", skip: false, pause: false, patch: rates });
    assert.equal(rateSaved.ok, true);
    assert.equal((await rulesFor(db, "smoke-rates")).minRates.youtube_integration, 40000);

    const handles = questionnaireFieldPatch(
      "platforms",
      (name) => (name === "handleTwitch" ? "@smoke" : ""),
      (name) => (name === "platforms" ? ["Twitch"] : []),
    );
    assert.equal(handles.handles?.Twitch, "@smoke");
    const handleSaved = await saveQuestionnaireStep(db, viewer, { step: "platforms", skip: false, pause: false, patch: handles });
    assert.equal(handleSaved.ok, true);
    const profile = (await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, "smoke-rates")))[0];
    assert.equal(profile?.handles?.includes("Twitch @smoke"), true);

    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
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
