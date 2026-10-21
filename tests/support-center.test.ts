import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { approvalEmails } from "../src/db/schema";
import { helpArticle, searchHelp } from "../src/lib/help-center";
import { getDealForViewer } from "../src/lib/queries";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { sitemapPublicPaths } from "../src/lib/public-meta";
import { listSupportTickets, openSupportTicket, replyToSupportTicket } from "../src/lib/support-tickets";
import { saveStatusIncident, statusSnapshot } from "../src/lib/status-page";
import { abby, admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("support center", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("help search, own tickets, status, and no mail", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    assert.equal(searchHelp("").length >= 5, true);
    assert.equal(searchHelp("privacy").some((article) => article.slug === "privacy"), true);
    assert.equal(searchHelp("no-such-guide").length, 0);
    const kids = helpArticle("kids-in-content");
    assert.match(kids?.body ?? "", /age ranges/i);
    assert.equal(/\$\s?\d/.test(JSON.stringify(searchHelp(""))), false);
    assert.equal(JSON.stringify(searchHelp("")).toLowerCase().includes("minimum"), false);

    const dropped = await openSupportTicket(db, {
      name: "Spam",
      email: "spam@example.com",
      category: "Portal",
      priority: "Normal",
      subject: "Buy now",
      body: "spam",
      honeypot: "https://spam.example",
    });
    assert.equal(dropped.ok && dropped.stored, false);

    const opened = await openSupportTicket(db, {
      name: "Abby Theriot",
      email: "theofficialtheriots@gmail.com",
      category: "Deal",
      priority: "High",
      subject: "Where is the draft",
      body: "I cannot find the upload.",
      honeypot: "",
      creatorId: "abby",
    });
    assert.equal(opened.ok, true);
    if (!opened.ok || !opened.stored) return;
    const own = await listSupportTickets(db, abby);
    assert.equal(own.length, 1);
    assert.equal(own[0]?.replies.length, 1);
    assert.equal((await listSupportTickets(db, mariclare)).length, 0);
    assert.equal((await listSupportTickets(db, null)).length, 0);
    assert.equal((await listSupportTickets(db, admin)).some((ticket) => ticket.id === opened.id), true);

    const waiting = await replyToSupportTicket(db, admin, {
      ticketId: opened.id,
      body: "Looking now.",
      status: "waiting",
    });
    assert.equal(waiting.ok && waiting.status, "waiting");
    const stranger = await replyToSupportTicket(db, mariclare, { ticketId: opened.id, body: "Not mine." });
    assert.equal(stranger.ok, false);
    const back = await replyToSupportTicket(db, abby, { ticketId: opened.id, body: "Thanks, I see it." });
    assert.equal(back.ok && back.status, "open");
    const resolved = await replyToSupportTicket(db, admin, {
      ticketId: opened.id,
      body: "Closed.",
      status: "resolved",
    });
    assert.equal(resolved.ok && resolved.status, "resolved");

    const down = await statusSnapshot(db, { ok: false });
    assert.equal(down.healthOk, false);
    assert.equal(down.banner, true);
    const incident = await saveStatusIncident(db, admin, {
      title: "Draft upload delayed",
      body: "Uploads are slow. Nothing was emailed.",
      state: "investigating",
    });
    assert.equal(incident.ok, true);
    assert.equal((await saveStatusIncident(db, abby, { title: "No", body: "No", state: "investigating" })).ok, false);
    const up = await statusSnapshot(db, { ok: true });
    assert.equal(up.banner, true);
    assert.equal(up.incidents[0]?.title, "Draft upload delayed");

    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const help = source("src/app/help/page.tsx");
    const status = source("src/app/status/page.tsx");
    const support = source("src/app/support/page.tsx");
    assert.match(help, /publicPageMeta/);
    assert.match(help, /name="website"/);
    assert.match(help, /ticketErrorNote\(params\.ticketError\)/);
    assert.equal(help.includes("{params.ticketError}"), false);
    assert.match(status, /The portal is not responding/);
    assert.match(status, /portalHealth/);
    assert.match(support, /No notes yet\. Nothing is emailed\./);
    assert.match(support, /Saved in the portal\. Nothing was sent\./);
    assert.match(support, /TICKET_STATUSES/);
    const migration = source("drizzle/0050_support_center.sql");
    assert.equal(migration.toLowerCase().includes("drop "), false);
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.includes("KOSBLING"), true);
    assert.equal(sitemapPublicPaths().includes("/help"), true);
    assert.equal(sitemapPublicPaths().includes("/status"), true);
    assert.equal(isPublicMarketingPath("/help", ""), true);
    assert.equal(source("src/lib/support-tickets.ts").includes("createApprovalEmail"), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
