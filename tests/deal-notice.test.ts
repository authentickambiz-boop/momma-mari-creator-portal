import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals } from "../src/db/schema";
import { dealFlagQuery, saveBrandReplyDraft } from "../src/lib/deal-review";
import { dealNoticeCode } from "../src/lib/deal-notice-notes";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("deal notices", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("a reply draft, a rate, and saved dates tell you what happened and leave KOSBLING alone", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    assert.equal(
      dealFlagQuery({ dealId: "vev", creator: "mariclare", reply: "saved" }),
      "/deals/vev?creator=mariclare&reply=saved",
    );
    assert.equal(
      dealFlagQuery({ dealId: "vev", creator: "mariclare", replyError: "Write the reply first." }),
      "/deals/vev?creator=mariclare&replyError=Write+the+reply+first.",
    );
    assert.equal(
      dealFlagQuery({ dealId: "vev", rateError: "Set the agreed rate before asking the creator to confirm it." }).includes("creator="),
      false,
    );

    const vevBefore = (await db.select().from(deals).where(eq(deals.id, "vev")))[0];
    const empty = await saveBrandReplyDraft(db, { dealId: "vev", actorEmail: admin.email, actorRole: "admin", body: "  " });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.error, "Write the reply first.");
    const saved = await saveBrandReplyDraft(db, {
      dealId: "vev",
      actorEmail: admin.email,
      actorRole: "admin",
      body: "Thanks for writing.",
    });
    assert.equal(saved.ok, true);
    assert.equal((await getDealForViewer(db, admin, "vev"))?.brandReplyDraft, "Thanks for writing.");

    const actions = source("src/app/review-actions.ts");
    assert.match(actions, /datesError: dealNoticeCode\("Enter the rate in dollars\."\)/);
    assert.match(actions, /dealFlagQuery\(\{ dealId, creator, reply: "saved" \}\)/);
    assert.equal(actions.includes("replyError=1"), false);
    const dealPage = source("src/app/deals/[id]/page.tsx");
    assert.match(dealPage, /Draft saved\. Nothing was emailed\./);
    assert.match(dealPage, /Asked\. Nothing was emailed\./);
    assert.match(dealPage, /Rate confirmed\. Nothing was paid\./);
    assert.match(dealPage, /Dates saved\. Nothing was emailed or paid\./);
    const review = source("src/app/review/page.tsx");
    assert.match(review, /params\.saved === "draft"/);

    const vev = (await db.select().from(deals).where(eq(deals.id, "vev")))[0];
    assert.equal(vev?.workflowStage, vevBefore?.workflowStage);
    assert.equal(vev?.visibleToCreator, vevBefore?.visibleToCreator);
    assert.equal(vev?.brand, vevBefore?.brand);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
    assert.equal(kosblingAfter?.brandReplyDraft ?? null, null);
  });
});
