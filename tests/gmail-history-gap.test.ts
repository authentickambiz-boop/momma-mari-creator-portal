import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals, gmailWatches } from "../src/db/schema";
import { ingestGmailPush, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

describe("gmail history gap", { concurrency: 1 }, () => {
let db: PortalDb;
before(() => {
  db = openTestDb();
});

test("an expired Gmail history cursor backfills the recent inbox and does not jump on a failed read", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const source = readFileSync(path.join(process.cwd(), "src/lib/gmail-push.ts"), "utf8");
  assert.match(source, /\/messages\?labelIds=INBOX/);
  assert.doesNotMatch(source, /\/messages\/send|gmail\.send/);

  const mailbox = "mmaclamroc@gmail.com";
  const cursor = "8000";
  const existingWatch = (await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0];
  if (existingWatch) {
    await db.update(gmailWatches).set({ historyId: cursor, creatorId: "mariclare", updatedAt: "2026-10-19T20:00:00.000Z" }).where(eq(gmailWatches.mailbox, mailbox));
  } else {
    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "mariclare",
      historyId: cursor,
      expiration: null,
      topic: null,
      updatedAt: "2026-10-19T20:00:00.000Z",
    });
  }
  const gap: GmailHistoryMessage = {
    id: "gap-mail-1",
    threadId: "gap-thread-1",
    from: "Ada <ada@cedar.example>",
    to: mailbox,
    subject: "Cedar samples",
    labelIds: ["INBOX"],
  };
  let recentReads = 0;
  const failed = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "9000" }, {
    client: {
      listAdded: async () => ({ latestHistoryId: cursor, expired: true, messages: [] }),
      listRecent: async () => {
        recentReads += 1;
        throw new Error("Gmail read failed (503)");
      },
      getMessage: async () => gap,
    },
  });
  assert.equal(failed.status, 503);
  assert.equal(recentReads, 1);
  assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, cursor);
  assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-gap-mail-1"))).length, 0);

  const filled = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "9001" }, {
    client: {
      listAdded: async () => ({ latestHistoryId: cursor, expired: true, messages: [] }),
      listRecent: async () => [{ id: gap.id, threadId: gap.threadId }],
      getMessage: async () => gap,
    },
  });
  assert.equal(filled.status, 200);
  if (!("backfilled" in filled.body) || !("createdDealIds" in filled.body) || !("expired" in filled.body)) throw new Error("expected a backfill");
  assert.equal(filled.body.expired, true);
  assert.equal(filled.body.backfilled, true);
  assert.deepEqual(filled.body.createdDealIds, ["mail-gap-mail-1"]);
  assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "9001");
  const hidden = await getDealForViewer(db, admin, "mail-gap-mail-1");
  assert.equal(hidden?.visibleToCreator, false);
  assert.equal(hidden?.workflowStage, "offer_received");
  assert.equal(hidden?.brand, "Ada");
  assert.equal(await getDealForViewer(db, mariclare, "mail-gap-mail-1"), null);

  const repeat = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "9002" }, {
    client: {
      listAdded: async () => ({ latestHistoryId: "9001", expired: true, messages: [] }),
      listRecent: async () => [{ id: gap.id, threadId: gap.threadId }],
      getMessage: async () => gap,
    },
  });
  if (!("createdDealIds" in repeat.body) || !("skippedDuplicate" in repeat.body)) throw new Error("expected a repeat backfill");
  assert.deepEqual(repeat.body.createdDealIds, []);
  assert.equal((repeat.body.skippedDuplicate ?? 0) > 0, true);
  assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-gap-mail-1"))).length, 1);

  const jumped = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "9003" }, {
    client: {
      listAdded: async () => ({ latestHistoryId: "9003", expired: true, messages: [] }),
      getMessage: async () => {
        throw new Error("no recent reader");
      },
    },
  });
  assert.equal(jumped.status, 200);
  if (!("backfilled" in jumped.body)) throw new Error("expected the cursor jump when no recent reader is available");
  assert.equal(jumped.body.backfilled, false);
  assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "9003");

  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, kosblingBefore?.stageEvents?.length);
});
});
