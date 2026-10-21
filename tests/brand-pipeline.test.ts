import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandContacts, brandCrmEntries, brandPipelineCards, deals, gmailBridgeThreads } from "../src/db/schema";
import {
  listPipeline,
  movePipelineCard,
  pipelineReminders,
  seedBrandPipeline,
  stageFromWorkflow,
} from "../src/lib/brand-pipeline";
import { paymentsEnabled } from "../src/lib/payments-config";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

const TODAY = "2026-10-21";

async function insertDeal(db: PortalDb) {
  await db.insert(deals).values({
    id: "deal-pipe-1",
    creatorId: "mariclare",
    brand: "Pipeline Sample",
    contact: "Pat <pat@pipelinesample.test>",
    status: "active",
    workflowStage: "payment_pending",
    rateCents: 10000,
    deliverablesJson: "[]",
    visibleToCreator: false,
    chipsJson: "[]",
    uploadEnabled: false,
    needsCreator: false,
    sortOrder: 81,
    isSeed: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  });
}

describe("brand pipeline", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("the owner kanban is seeded from deals, contacts, and the deal inbox", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const dealCount = (await db.select().from(deals)).length;
    assert.equal(stageFromWorkflow("offer_received"), "lead");
    assert.equal(stageFromWorkflow("offer_shared"), "intake");
    assert.equal(stageFromWorkflow("creator_interested"), "brief");
    assert.equal(stageFromWorkflow("contract_review"), "negotiating");
    assert.equal(stageFromWorkflow("signed_by_creator"), "contracted");
    assert.equal(stageFromWorkflow("draft_due"), "in_production");
    assert.equal(stageFromWorkflow("scheduled_posted"), "posted");
    assert.equal(stageFromWorkflow("payment_pending"), "invoiced");
    assert.equal(stageFromWorkflow("paid"), "paid");
    assert.equal(paymentsEnabled(), false);
    assert.equal((await seedBrandPipeline(db, mariclare)).ok, false);

    await insertDeal(db);
    await db.insert(brandContacts).values({
      id: "contact-pipe-1",
      dealId: null,
      approvalId: "approval-pipe-1",
      company: "Intake Co",
      contactEmail: "buyer@intake.test",
      savedBy: "kamron@mommamari.com",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    await db.insert(brandContacts).values({
      id: "contact-pipe-deal",
      dealId: "deal-pipe-1",
      approvalId: "approval-pipe-deal",
      company: "Pipeline Sample",
      contactEmail: "pat@pipelinesample.test",
      savedBy: "kamron@mommamari.com",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    await db.insert(brandCrmEntries).values({
      id: "crm-pipe-1",
      brandKey: "north home",
      kind: "note",
      actorName: "Kamron",
      nextFollowUp: "2026-10-01",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    await db.insert(gmailBridgeThreads).values({
      id: "inbox-pipe-1",
      creatorId: "mariclare",
      mailbox: "kamron@mommamari.com",
      threadId: "thread-pipe-1",
      brand: "Inbox Brand",
      subject: "Holiday brief",
      snippet: "We would like to collaborate.",
      fromEmail: "hello@inboxbrand.test",
      classification: "inquiry",
      private: false,
      createdAt: "2026-10-18T00:00:00.000Z",
      updatedAt: "2026-10-18T00:00:00.000Z",
    });
    await db.insert(gmailBridgeThreads).values({
      id: "inbox-pipe-skip",
      creatorId: "mariclare",
      mailbox: "kamron@mommamari.com",
      threadId: "thread-pipe-skip",
      brand: "Newsletter",
      subject: "Weekly news",
      snippet: "Unsubscribe",
      fromEmail: "news@newsletter.test",
      classification: "not_deal",
      private: false,
      createdAt: "2026-10-18T00:00:00.000Z",
      updatedAt: "2026-10-18T00:00:00.000Z",
    });
    await db.insert(gmailBridgeThreads).values({
      id: "inbox-pipe-linked",
      creatorId: "mariclare",
      mailbox: "kamron@mommamari.com",
      threadId: "thread-pipe-linked",
      dealId: "deal-pipe-1",
      brand: "Pipeline Sample",
      subject: "Invoice",
      snippet: "Please invoice us.",
      fromEmail: "pat@pipelinesample.test",
      classification: "deal",
      private: false,
      createdAt: "2026-10-18T00:00:00.000Z",
      updatedAt: "2026-10-18T00:00:00.000Z",
    });

    const first = await seedBrandPipeline(db, admin);
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.created > 0, true);
    const second = await seedBrandPipeline(db, admin);
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.created, 0);

    const board = await listPipeline(db, admin);
    assert.equal(board.ok, true);
    if (!board.ok) return;
    const cards = board.columns.flatMap((column) => column.cards);
    const sample = cards.find((card) => card.sourceKey === "deal:deal-pipe-1");
    assert.equal(sample?.stage, "invoiced");
    assert.equal(sample?.valueCents, 10000);
    assert.equal(cards.find((card) => card.sourceKey === "deal:kosbling")?.stage, "in_production");
    assert.equal(cards.some((card) => card.sourceKey === "contact:contact-pipe-1" && card.stage === "intake"), true);
    assert.equal(cards.some((card) => card.sourceKey === "contact:contact-pipe-deal"), false);
    assert.equal(cards.some((card) => card.sourceKey === "crm:crm-pipe-1" && card.stage === "lead"), true);
    assert.equal(cards.some((card) => card.sourceKey === "inbox:inbox-pipe-1" && card.stage === "lead"), true);
    assert.equal(cards.some((card) => card.brand === "Newsletter"), false);
    assert.equal(cards.some((card) => card.sourceKey === "inbox:inbox-pipe-linked"), false);
    assert.equal(board.columns.map((column) => column.id).join(","), "lead,intake,brief,negotiating,contracted,in_production,posted,invoiced,paid,rebook");

    const due = await pipelineReminders(db, admin, TODAY);
    assert.equal(due.ok, true);
    if (due.ok) {
      assert.equal(due.reminders.some((item) => item.brand === "north home"), true);
      assert.equal(due.reminders.some((item) => item.brand === "Pipeline Sample"), true);
    }

    assert.equal(sample?.id != null, true);
    const moved = await movePipelineCard(db, admin, sample!.id, "rebook");
    assert.equal(moved.ok, true);
    const again = await seedBrandPipeline(db, admin);
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.created, 0);
    const after = await listPipeline(db, admin);
    assert.equal(after.ok, true);
    if (after.ok) {
      assert.equal(after.columns.find((column) => column.id === "rebook")?.cards.some((card) => card.id === sample?.id), true);
    }
    const quiet = await pipelineReminders(db, admin, TODAY);
    assert.equal(quiet.ok, true);
    if (quiet.ok) assert.equal(quiet.reminders.some((item) => item.brand === "Pipeline Sample"), false);

    const storedDeal = await db.select().from(deals).where(eq(deals.id, "deal-pipe-1"));
    assert.equal(storedDeal[0]?.workflowStage, "payment_pending");
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal((await db.select().from(deals)).length, dealCount + 1);
    assert.equal((await listPipeline(db, mariclare)).ok, false);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.id === "pipeline"), false);
    assert.equal(visiblePortalTabs(admin).some((tab) => tab.label === "Deal pipeline"), true);
    const lib = readFileSync(path.join(process.cwd(), "src/lib/brand-pipeline.ts"), "utf8");
    assert.equal(lib.includes("api.stripe.com"), false);
    assert.equal(lib.includes("messages.send"), false);
    assert.match(readFileSync(path.join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8"), /PipelineFollowUps/);
    assert.equal((await db.select().from(brandPipelineCards)).some((card) => card.sourceKey === "deal:kosbling"), true);
  });
});
