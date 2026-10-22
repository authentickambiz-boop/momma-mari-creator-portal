import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, livePosts } from "../src/db/schema";
import { postErrorCode, postErrorNote, submitLivePosts } from "../src/lib/fulfillment";
import { getDealForViewer } from "../src/lib/queries";
import { abby, admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("post link notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a bad live link says what was wrong, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const postsBefore = (await db.select().from(livePosts).where(eq(livePosts.dealId, "kosbling"))).length;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    assert.equal(postErrorCode("Each post link has to start with http:// or https://."), "url");
    assert.equal(postErrorCode("Platform must be TikTok, Instagram, Facebook, YouTube, YouTube Live, Twitch, or Kick."), "platform");
    assert.equal(postErrorCode("Add at least one live post link."), "link");
    assert.equal(postErrorCode("This video isn't approved for posting yet. Nothing was changed."), "early");
    assert.equal(postErrorCode("Add the brand email before the post links can be queued."), "email");
    assert.equal(postErrorCode("You can't update this deal."), "own");
    assert.equal(postErrorCode("nope"), "1");
    assert.equal(postErrorNote("url"), "Each post link has to start with http:// or https://.");
    assert.equal(postErrorNote("early"), "This video isn't approved for posting yet. Nothing was changed.");
    assert.equal(postErrorNote("1"), null);
    assert.equal(postErrorNote("hello"), null);
    assert.equal(postErrorNote(undefined), null);

    const badUrl = await submitLivePosts(db, {
      dealId: "kosbling",
      links: [{ platform: "tiktok", url: "not-a-link" }],
      actorEmail: mariclare.email,
      actorRole: mariclare.role,
      creatorId: mariclare.creatorId,
    });
    assert.equal(badUrl.ok, false);
    if (!badUrl.ok) assert.equal(postErrorCode(badUrl.error), "url");

    const badPlatform = await submitLivePosts(db, {
      dealId: "kosbling",
      links: [{ platform: "vine", url: "https://example.test/post" }],
      actorEmail: mariclare.email,
      actorRole: mariclare.role,
      creatorId: mariclare.creatorId,
    });
    assert.equal(badPlatform.ok, false);
    if (!badPlatform.ok) assert.equal(postErrorCode(badPlatform.error), "platform");

    const empty = await submitLivePosts(db, {
      dealId: "kosbling",
      links: [],
      actorEmail: mariclare.email,
      actorRole: mariclare.role,
      creatorId: mariclare.creatorId,
    });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(postErrorCode(empty.error), "link");

    const early = await submitLivePosts(db, {
      dealId: "kosbling",
      links: [{ platform: "tiktok", url: "https://example.test/post" }],
      actorEmail: mariclare.email,
      actorRole: mariclare.role,
      creatorId: mariclare.creatorId,
    });
    assert.equal(early.ok, false);
    if (!early.ok) assert.equal(postErrorCode(early.error), "early");

    const other = await submitLivePosts(db, {
      dealId: "kosbling",
      links: [{ platform: "tiktok", url: "https://example.test/post" }],
      actorEmail: abby.email,
      actorRole: abby.role,
      creatorId: abby.creatorId,
    });
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(postErrorCode(other.error), "own");

    assert.equal((await db.select().from(livePosts).where(eq(livePosts.dealId, "kosbling"))).length, postsBefore);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

    const actions = source("src/app/actions.ts");
    const submit = actions.slice(
      actions.indexOf("export async function submitLivePostsAction"),
      actions.indexOf("export async function confirmLivePostAction"),
    );
    assert.match(submit, /postErrorCode\(result\.error\)/);
    assert.equal(submit.includes("status === 409"), false);
    const confirm = actions.slice(
      actions.indexOf("export async function confirmLivePostAction"),
      actions.indexOf("export async function markPaymentAction"),
    );
    assert.match(confirm, /postErrorCode\(result\.error\)/);
    assert.equal(confirm.includes('includes("brand email")'), false);
    const board = source("src/components/deal-board.tsx");
    assert.match(board, /postErrorNote\(postError\)/);
    assert.match(board, /That post was not saved\. Nothing was emailed\./);

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
