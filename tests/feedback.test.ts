import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { approvalEmails } from "../src/db/schema";
import { listFeedback, saveFeedback } from "../src/lib/feedback";
import { getDealForViewer } from "../src/lib/queries";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { sitemapPublicPaths } from "../src/lib/public-meta";
import { abby, admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("feedback channel", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("notes are stored, rate limited, and only the owner can filter them", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    const dropped = await saveFeedback(db, null, {
      category: "Portal",
      rating: "5",
      body: "spam",
      followUp: false,
      email: "spam@example.com",
      name: "Spam",
      honeypot: "https://spam.example",
      ip: "203.0.113.8",
    });
    assert.equal(dropped.ok, true);
    assert.equal(dropped.stored, false);

    const needsEmail = await saveFeedback(db, null, {
      category: "Portal",
      rating: "4",
      body: "Please write back",
      followUp: true,
      email: "",
      name: "",
      honeypot: "",
      ip: "203.0.113.9",
    });
    assert.equal(needsEmail.ok, false);

    const saved = await saveFeedback(db, abby, {
      category: "Deals",
      rating: "2",
      body: "The deal list was hard to find.",
      followUp: true,
      email: "theofficialtheriots@gmail.com",
      name: "",
      honeypot: "",
      ip: "203.0.113.10",
    });
    assert.equal(saved.ok, true);
    const owner = await listFeedback(db, admin, {});
    assert.equal(owner.length, 1);
    assert.equal(owner[0]?.category, "Deals");
    assert.equal(owner[0]?.rating, 2);
    assert.equal(owner[0]?.audience, "creator");
    assert.equal(owner[0]?.followUp, true);
    assert.equal(JSON.stringify(owner).includes("203.0.113.10"), false);
    assert.equal((await listFeedback(db, abby, {})).length, 0);
    assert.equal((await listFeedback(db, null, {})).length, 0);
    assert.equal((await listFeedback(db, admin, { category: "Portal" })).length, 0);
    assert.equal((await listFeedback(db, admin, { rating: "2" })).length, 1);

    for (let count = 0; count < 3; count += 1) {
      assert.equal((await saveFeedback(db, null, {
        category: "Payments",
        rating: "3",
        body: `Again ${count}`,
        followUp: false,
        email: "repeat@example.com",
        name: "Repeat",
        honeypot: "",
        ip: `203.0.113.${20 + count}`,
      })).ok, true);
    }
    const limited = await saveFeedback(db, null, {
      category: "Payments",
      rating: "3",
      body: "Fourth",
      followUp: false,
      email: "repeat@example.com",
      name: "Repeat",
      honeypot: "",
      ip: "203.0.113.40",
    });
    assert.equal(limited.ok, false);

    for (let count = 0; count < 8; count += 1) {
      assert.equal((await saveFeedback(db, null, {
        category: "Something else",
        rating: "1",
        body: `Burst ${count}`,
        followUp: false,
        email: "",
        name: "",
        honeypot: "",
        ip: "203.0.113.50",
      })).ok, true);
    }
    assert.equal((await saveFeedback(db, null, {
      category: "Something else",
      rating: "1",
      body: "Ninth",
      followUp: false,
      email: "",
      name: "",
      honeypot: "",
      ip: "203.0.113.50",
    })).ok, false);

    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const page = source("src/app/feedback/page.tsx");
    const migration = source("drizzle/0049_feedback.sql");
    assert.match(page, /publicPageMeta/);
    assert.match(page, /name="rating"/);
    assert.match(page, /name="followUp"/);
    assert.match(page, /name="website"/);
    assert.match(page, /feedbackErrorNote\(params\.feedbackError\)/);
    assert.equal(page.includes("{params.feedbackError}"), false);
    assert.match(page, /Saved in the portal\. Nothing was emailed\./);
    assert.match(page, /Filter/);
    assert.equal(/\$\s?\d/.test(page), false);
    assert.equal(page.includes("stripe"), false);
    assert.equal(migration.toLowerCase().includes("drop "), false);
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.toLowerCase().includes("update "), false);
    assert.equal(migration.includes("KOSBLING"), true);
    assert.equal(sitemapPublicPaths().includes("/feedback"), true);
    assert.equal(isPublicMarketingPath("/feedback", ""), true);
    assert.match(source("src/components/site-footer.tsx"), /href="\/feedback"/);
    assert.equal(source("src/lib/feedback.ts").includes("createApprovalEmail"), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
