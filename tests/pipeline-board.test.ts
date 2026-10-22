import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandPipelineCards, deals } from "../src/db/schema";
import {
  PIPELINE_STAGES,
  filterPipelineColumns,
  followUpLabel,
  followUpStatus,
  listPipeline,
  nextPipelineStage,
  parsePipelineDollars,
  parsePipelineFollowUp,
  pipelineCardNextLine,
  pipelineDollarsInput,
  pipelineSumLabel,
  savePipelineCard,
  seedBrandPipeline,
  summarizePipeline,
} from "../src/lib/brand-pipeline";
import { formatMoney } from "../src/lib/format";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("pipeline board", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("stages explain themselves and the owner can edit a card without touching the deal", async () => {
    assert.equal(PIPELINE_STAGES.length, 10);
    for (const stage of PIPELINE_STAGES) {
      assert.equal(stage.blurb.length > 10, true);
      assert.equal(stage.forward.length > 10, true);
      assert.equal(stage.nextAction.length > 3, true);
    }
    assert.equal(nextPipelineStage("lead"), "intake");
    assert.equal(nextPipelineStage("invoiced"), "paid");
    assert.equal(nextPipelineStage("rebook"), null);
    assert.equal(followUpStatus("2026-10-20", "2026-10-21"), "overdue");
    assert.equal(followUpStatus("2026-10-21", "2026-10-21"), "today");
    assert.equal(followUpStatus("2026-10-26", "2026-10-21"), "upcoming");
    assert.equal(followUpStatus(null, "2026-10-21"), "none");
    assert.equal(followUpLabel("overdue", "2026-10-01"), "Overdue · Oct 1");
    assert.equal(pipelineCardNextLine("  Holiday brief  ", "Say hello"), "Holiday brief");
    assert.equal(pipelineCardNextLine(null, "Say hello"), "Say hello");
    assert.equal(pipelineDollarsInput(250000), "2500");
    assert.equal(pipelineDollarsInput(1999), "19.99");
    assert.equal(pipelineDollarsInput(null), "");
    assert.equal(parsePipelineDollars("$1,500"), 150000);
    assert.equal(parsePipelineDollars("TBD"), null);
    assert.equal(parsePipelineDollars(""), null);
    assert.equal(parsePipelineDollars("12.345"), "bad");
    assert.equal(parsePipelineFollowUp(""), null);
    assert.equal(parsePipelineFollowUp("2026-02-31"), "bad");
    assert.equal(parsePipelineFollowUp("2026-11-02"), "2026-11-02");
    assert.equal(pipelineSumLabel(0, 0, 0, formatMoney), "—");
    assert.equal(pipelineSumLabel(2, 0, 2, formatMoney), "TBD");
    assert.equal(pipelineSumLabel(2, 150000, 1, formatMoney), `${formatMoney(150000)} + TBD`);

    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    await db.insert(deals).values({
      id: "deal-pipe-hidden",
      creatorId: "mariclare",
      brand: "Hidden Pipeline",
      contact: "Pat <pat@hiddenpipeline.test>",
      status: "active",
      workflowStage: "offer_received",
      rateCents: 5000,
      deliverablesJson: "[]",
      visibleToCreator: false,
      chipsJson: "[]",
      uploadEnabled: false,
      needsCreator: false,
      sortOrder: 82,
      isSeed: false,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    const seeded = await seedBrandPipeline(db, admin);
    assert.equal(seeded.ok, true);
    const board = await listPipeline(db, admin);
    assert.equal(board.ok, true);
    if (!board.ok) return;
    const hidden = board.columns.flatMap((column) => column.cards).find((card) => card.sourceKey === "deal:deal-pipe-hidden");
    const kosbling = board.columns.flatMap((column) => column.cards).find((card) => card.sourceKey === "deal:kosbling");
    assert.equal(hidden?.creatorId, "mariclare");
    assert.equal(hidden?.note, null);
    assert.ok(kosbling);
    const saved = await savePipelineCard(db, admin, kosbling.id, {
      stage: "posted",
      nextFollowUp: "2026-10-01",
      note: "Private: call the brand",
      value: "$2,500",
    });
    assert.equal(saved.ok, true);
    const cleared = await savePipelineCard(db, admin, hidden!.id, {
      stage: "lead",
      nextFollowUp: "",
      note: "",
      value: "",
    });
    assert.equal(cleared.ok, true);
    assert.equal((await savePipelineCard(db, mariclare, kosbling.id, { stage: "paid", nextFollowUp: "", note: "nope", value: "1" })).ok, false);
    const badDate = await savePipelineCard(db, admin, kosbling.id, { stage: "paid", nextFollowUp: "yesterday", note: "", value: "1" });
    assert.equal(badDate.ok, false);
    if (!badDate.ok) assert.equal(badDate.code, "date");
    const missing = await savePipelineCard(db, admin, "missing-card", { stage: "lead", nextFollowUp: "", note: "", value: "" });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "missing");

    const after = await listPipeline(db, admin);
    assert.equal(after.ok, true);
    if (!after.ok) return;
    const edited = after.columns.flatMap((column) => column.cards).find((card) => card.id === kosbling.id);
    assert.equal(edited?.stage, "posted");
    assert.equal(edited?.note, "Private: call the brand");
    assert.equal(edited?.valueCents, 250000);
    assert.equal(edited?.nextFollowUp, "2026-10-01");
    const stillHidden = after.columns.flatMap((column) => column.cards).find((card) => card.id === hidden?.id);
    assert.equal(stillHidden?.valueCents, null);
    assert.equal(stillHidden?.note, null);
    const mine = filterPipelineColumns(after.columns, "mariclare");
    assert.equal(mine.flatMap((column) => column.cards).some((card) => card.id === hidden?.id), true);
    assert.equal(mine.flatMap((column) => column.cards).some((card) => card.creatorId && card.creatorId !== "mariclare"), false);
    const summary = summarizePipeline(mine, "2026-10-21");
    assert.equal(summary.overdue >= 1, true);
    const posted = summary.stages.find((stage) => stage.id === "posted");
    assert.equal((posted?.valueCents ?? 0) >= 250000, true);
    assert.equal((await listPipeline(db, mariclare)).ok, false);

    const stored = await db.select().from(deals).where(eq(deals.id, "kosbling"));
    assert.equal(stored[0]?.workflowStage, kosblingBefore?.workflowStage);
    const hiddenDeal = await db.select().from(deals).where(eq(deals.id, "deal-pipe-hidden"));
    assert.equal(hiddenDeal[0]?.visibleToCreator, false);
    assert.equal(hiddenDeal[0]?.workflowStage, "offer_received");
    const row = await db.select().from(brandPipelineCards).where(eq(brandPipelineCards.id, kosbling.id));
    assert.equal(row[0]?.note, "Private: call the brand");

    const page = source("src/app/pipeline/page.tsx");
    const boardSource = source("src/components/pipeline-board.tsx");
    assert.match(page, /PipelineBoard/);
    assert.match(page, /filterPipelineColumns/);
    assert.equal(page.includes("Save date"), false);
    assert.match(boardSource, /Move to next stage/);
    assert.match(boardSource, /draggable/);
    assert.match(boardSource, /pipeline-dialog/);
    assert.match(boardSource, /is-overdue/);
    const lib = source("src/lib/brand-pipeline.ts");
    assert.equal(lib.includes("api.stripe.com"), false);
    assert.equal(lib.includes("messages.send"), false);
    const css = source("src/app/globals.css");
    assert.match(css, /\.pipeline-board \{/);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /grid-auto-columns: 88%/);
  });
});
