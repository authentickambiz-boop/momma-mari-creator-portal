import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { deals, gmailWatches } from "../src/db/schema";
import { ingestGmailPush, recentInboxMessages, RECENT_PAGE_LIMIT, type GmailHistoryMessage } from "../src/lib/gmail-push";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

describe("gmail inbox pages", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("an expired history read keeps the second inbox page and does not send", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const source = readFileSync(path.join(process.cwd(), "src/lib/gmail-push.ts"), "utf8");
    assert.equal(RECENT_PAGE_LIMIT, 2);
    assert.match(source, /pageToken=\$\{encodeURIComponent\(pageToken\)\}/);
    assert.match(source, /Gmail inbox page failed\./);
    assert.doesNotMatch(source, /\/messages\/send|gmail\.send/);

    const first = Array.from({ length: 20 }, (_, index) => ({ id: `page-a-${index}`, threadId: `thread-a-${index}` }));
    const second = [{ id: "page-a-0", threadId: "thread-a-0" }, { id: "page-b-1", threadId: "thread-b-1" }, { id: "no-thread", threadId: "" }];
    assert.equal(recentInboxMessages([{ messages: first }, { messages: second }]).length, 21);
    assert.equal(recentInboxMessages([{ messages: first }, { messages: second }]).at(-1)?.id, "page-b-1");

    const mailbox = "mmaclamroc@gmail.com";
    await db.insert(gmailWatches).values({
      mailbox,
      creatorId: "mariclare",
      historyId: "8100",
      expiration: null,
      topic: null,
      updatedAt: "2026-10-19T20:00:00.000Z",
    }).onConflictDoUpdate({
      target: gmailWatches.mailbox,
      set: { historyId: "8100", creatorId: "mariclare", updatedAt: "2026-10-19T20:00:00.000Z" },
    });

    const ids = Array.from({ length: 21 }, (_, index) => `inbox-page-${index}`);
    let reads = 0;
    const filled = await ingestGmailPush(db, { emailAddress: mailbox, historyId: "8200" }, {
      client: {
        listAdded: async () => ({ latestHistoryId: "8100", expired: true, messages: [] }),
        listRecent: async () => ids.map((id) => ({ id, threadId: `thread-${id}` })),
        getMessage: async (id) => {
          reads += 1;
          const message: GmailHistoryMessage = {
            id,
            threadId: `thread-${id}`,
            from: "Ada <ada@cedar.example>",
            to: mailbox,
            subject: "Cedar samples",
            labelIds: ["INBOX"],
          };
          return message;
        },
      },
    });
    assert.equal(filled.status, 200);
    assert.equal(reads, 21);
    if (!("createdDealIds" in filled.body) || !filled.body.createdDealIds) throw new Error("expected created deals");
    assert.equal(filled.body.createdDealIds.length, 21);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "mail-inbox-page-20"))).length, 1);
    assert.equal(await getDealForViewer(db, mariclare, "mail-inbox-page-20"), null);
    assert.equal((await db.select().from(gmailWatches).where(eq(gmailWatches.mailbox, mailbox)))[0]?.historyId, "8200");

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
