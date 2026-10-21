import assert from "node:assert/strict";
import { readFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { GET as listBriefs } from "../src/app/api/bot/briefs/route";
import { getDb } from "../src/db/getDb";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, briefNotices } from "../src/db/schema";
import { saveBrandBrief } from "../src/lib/brand-brief";
import { KAMRON_NOTIFY_EMAIL, listNewBriefs } from "../src/lib/brief-notify";
import { giftGuidePackage, giftGuidePriceLabel, saveGiftGuideReservation, type GiftGuideReservationInput } from "../src/lib/gift-guide";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function reservation(overrides: Partial<GiftGuideReservationInput> = {}): GiftGuideReservationInput {
  return {
    brand: "Cedar Soap",
    contactName: "June Buyer",
    email: "june.buyer@cedarsoap.test",
    website: "https://cedarsoap.test",
    productName: "Cloud Wash",
    productUrl: "https://cedarsoap.test/cloud-wash",
    retailPrice: "18",
    category: "new-parents",
    packageId: "bench",
    promoCode: "HOLIDAY",
    notes: "Please feature the unscented bottle.",
    ackPaid: "yes",
    ackApproval: "yes",
    ackKids: "yes",
    ackUpfront: "yes",
    honeypot: "",
    ...overrides,
  };
}

const inquireBrief = {
  brand: "Cedar Soap",
  companyWebsite: "https://cedarsoap.test",
  name: "June Buyer",
  title: "Partnerships",
  email: "June.Buyer@CedarSoap.test",
  phone: "919-555-0100",
  agency: "yes",
  clientBrand: "Cedar Soap",
  creators: ["mariclare", "recommend"],
  goal: "Clicks on a fall code",
  deliverables: "1 TikTok and 1 Instagram story",
  budget: "Under $1,000",
  budgetKind: "Paid",
  usage: "Organic only",
  usageDuration: "30 days",
  exclusivity: "None",
  timeline: "Ship Nov 1, live Nov 15",
  approvals: "One round",
  billingContact: "June Buyer",
  billingEmail: "ap@cedarsoap.test",
  legalEntity: "Cedar Soap LLC",
  poNeeded: "no",
  paymentTerms: "Net 30",
  paymentMethod: "ACH",
  deposit: "no",
  productSample: "yes",
  heardAbout: "Instagram",
};

describe("brief notices", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a honeypot brief stores nothing and does not mail", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const noticesBefore = (await db.select().from(briefNotices)).length;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const dropped = await saveBrandBrief(db, {
      brand: "Honeypot Co",
      email: "bot@honeypot.test",
      budget: "Under $1,000",
      creators: ["mariclare"],
      honeypot: "https://spam.example",
    });
    assert.equal(dropped.ok, true);
    const droppedGuide = await saveGiftGuideReservation(db, reservation({ honeypot: "https://spam.test", brand: "Honeypot Guide" }));
    assert.equal(droppedGuide.ok, true);
    if (droppedGuide.ok) assert.equal(droppedGuide.id, "dropped");
    assert.equal((await db.select().from(briefNotices)).length, noticesBefore);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
  });

  test("an inquire brief is listed once and stays unsent without mail settings", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFY_EMAIL_FROM;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const saved = await saveBrandBrief(db, inquireBrief);
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const row = (await db.select().from(briefNotices).where(eq(briefNotices.sourceId, saved.id)))[0];
    assert.equal(row?.source, "inquire");
    assert.equal(row?.program, "inquire");
    assert.equal(row?.brand, "Cedar Soap");
    assert.equal(row?.contactName, "June Buyer");
    assert.equal(row?.contactEmail, "june.buyer@cedarsoap.test");
    assert.equal(row?.budget, "Under $1,000");
    assert.equal(row?.emailStatus, "unconfigured");
    assert.match(row?.emailDetail ?? "", /RESEND_API_KEY/);
    assert.match(row?.emailDetail ?? "", /NOTIFY_EMAIL_FROM/);
    assert.equal(row?.deliveredAt, null);

    const first = await listNewBriefs(db);
    assert.equal(first.email.configured, false);
    assert.equal(first.email.to, KAMRON_NOTIFY_EMAIL);
    assert.deepEqual(first.email.needed, ["RESEND_API_KEY", "NOTIFY_EMAIL_FROM"]);
    const packed = JSON.stringify(first);
    assert.equal(packed.includes("re_test"), false);
    const notice = first.briefs.find((item) => item.sourceId === saved.id);
    assert.equal(notice?.program, "inquire");
    assert.equal(notice?.budget, "Under $1,000");
    const second = await listNewBriefs(db);
    assert.equal(second.briefs.some((item) => item.sourceId === saved.id), false);
    const kosbling = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosbling?.brand, "KOSBLING");
  });

  test("a gift-guide reservation notifies with the package price and keeps one draft", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFY_EMAIL_FROM;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const saved = await saveGiftGuideReservation(db, reservation({ brand: "North Pine", email: "june.buyer@northpine.test" }));
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore + 1);
    const draft = (await db.select().from(approvalEmails).where(eq(approvalEmails.id, saved.approvalId ?? "")))[0];
    assert.equal(draft?.status, "pending");
    assert.equal(draft?.sentAt, null);
    const chosen = giftGuidePackage("bench");
    assert.ok(chosen);
    const row = (await db.select().from(briefNotices).where(eq(briefNotices.sourceId, saved.id)))[0];
    assert.equal(row?.source, "gift-guide");
    assert.equal(row?.program, "gift-guide");
    assert.equal(row?.brand, "North Pine");
    assert.equal(row?.contactEmail, "june.buyer@northpine.test");
    assert.equal(row?.budget, `${chosen.name}: ${giftGuidePriceLabel(chosen)}`);
    assert.equal(row?.emailStatus, "unconfigured");
  });

  test("configured mail posts the brief fields and hides the key", async () => {
    const previousKey = process.env.RESEND_API_KEY;
    const previousFrom = process.env.NOTIFY_EMAIL_FROM;
    const secret = "re_test_key_do_not_log";
    process.env.RESEND_API_KEY = secret;
    process.env.NOTIFY_EMAIL_FROM = "Momma Mari <notify@mommamari.com>";
    const original = globalThis.fetch;
    const captured = { url: "", body: "", authorization: "" };
    globalThis.fetch = async (input, init) => {
      captured.url = String(input);
      captured.body = String(init?.body ?? "");
      captured.authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    };
    try {
      const saved = await saveBrandBrief(db, { ...inquireBrief, brand: "Harbor Soap", email: "June.Buyer@HarborSoap.test" });
      assert.equal(saved.ok, true);
      if (!saved.ok) return;
      assert.equal(captured.url, "https://api.resend.com/emails");
      const body = JSON.parse(captured.body) as {
        to: string[];
        subject: string;
        text: string;
        from: string;
      };
      assert.deepEqual(body.to, [KAMRON_NOTIFY_EMAIL]);
      assert.equal(body.from, "Momma Mari <notify@mommamari.com>");
      assert.match(body.subject, /Harbor Soap/);
      assert.match(body.text, /Brand: Harbor Soap/);
      assert.match(body.text, /June Buyer <june\.buyer@harborsoap\.test>/);
      assert.match(body.text, /Program: inquire/);
      assert.match(body.text, /Budget: Under \$1,000/);
      assert.equal(captured.authorization, `Bearer ${secret}`);
      const row = (await db.select().from(briefNotices).where(eq(briefNotices.sourceId, saved.id)))[0];
      assert.equal(row?.emailStatus, "sent");
      assert.equal(row?.emailDetail, null);
      const listed = await listNewBriefs(db);
      const packed = JSON.stringify(listed);
      assert.equal(packed.includes(secret), false);
      assert.equal(listed.email.configured, true);
      assert.deepEqual(listed.email.needed, []);

      globalThis.fetch = async () => new Response("nope", { status: 502 });
      const failed = await saveBrandBrief(db, { ...inquireBrief, brand: "Failed Soap", email: "June.Buyer@FailedSoap.test" });
      assert.equal(failed.ok, true);
      if (!failed.ok) return;
      const failedRow = (await db.select().from(briefNotices).where(eq(briefNotices.sourceId, failed.id)))[0];
      assert.equal(failedRow?.emailStatus, "failed");
      assert.equal(failedRow?.emailDetail, "Resend returned 502");
      assert.equal((failedRow?.emailDetail ?? "").includes(secret), false);

      globalThis.fetch = async () => {
        throw new Error("offline");
      };
      const dropped = await saveBrandBrief(db, { ...inquireBrief, brand: "Offline Soap", email: "June.Buyer@OfflineSoap.test" });
      assert.equal(dropped.ok, true);
      if (!dropped.ok) return;
      const offline = (await db.select().from(briefNotices).where(eq(briefNotices.sourceId, dropped.id)))[0];
      assert.equal(offline?.emailStatus, "failed");
      assert.equal(offline?.emailDetail, "The email request did not finish.");
    } finally {
      globalThis.fetch = original;
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
      if (previousFrom === undefined) delete process.env.NOTIFY_EMAIL_FROM;
      else process.env.NOTIFY_EMAIL_FROM = previousFrom;
    }
  });

  test("the bot route requires the token and the migration only adds", async () => {
    const previous = process.env.BOT_API_TOKEN;
    delete process.env.BOT_API_TOKEN;
    try {
      const unconfigured = await listBriefs(new Request("http://localhost/api/bot/briefs"));
      assert.equal(unconfigured.status, 503);
      const body = await unconfigured.json() as { error: string };
      assert.match(body.error, /not configured/);
    } finally {
      process.env.BOT_API_TOKEN = previous;
    }
    const missing = await listBriefs(new Request("http://localhost/api/bot/briefs"));
    assert.equal(missing.status, 401);
    const wrong = await listBriefs(new Request("http://localhost/api/bot/briefs", {
      headers: { authorization: "Bearer not-the-token" },
    }));
    assert.equal(wrong.status, 401);

    const route = source("src/app/api/bot/briefs/route.ts");
    const mailer = source("src/lib/brief-notify.ts");
    assert.match(route, /botGuard/);
    assert.match(route, /listNewBriefs/);
    assert.equal(route.includes("gmail.send"), false);
    assert.equal(mailer.includes("gmail.send"), false);
    assert.equal(mailer.includes("/messages/send"), false);
    const sql = source("drizzle/0051_brief_notices.sql");
    assert.equal(sql.toLowerCase().includes("drop"), false);
    assert.equal(sql.toLowerCase().includes("delete"), false);
    assert.match(sql, /KOSBLING/);
    assert.match(source(".env.example"), /RESEND_API_KEY/);
    assert.match(source(".env.example"), /NOTIFY_EMAIL_FROM/);
  });

  test("GET /api/bot/briefs returns a new brief once", async () => {
    const file = path.join(os.tmpdir(), `brief-notify-${process.pid}.sqlite`);
    for (const suffix of ["", "-shm", "-wal"]) {
      try { unlinkSync(`${file}${suffix}`); } catch { /* fresh file */ }
    }
    const previousPath = process.env.PORTAL_SQLITE_PATH;
    process.env.PORTAL_SQLITE_PATH = file;
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFY_EMAIL_FROM;
    try {
      const fileDb = await getDb();
      const saved = await saveBrandBrief(fileDb, { ...inquireBrief, brand: "Route Soap", email: "June.Buyer@RouteSoap.test" });
      assert.equal(saved.ok, true);
      const token = process.env.BOT_API_TOKEN;
      const first = await listBriefs(new Request("http://localhost/api/bot/briefs", {
        headers: { authorization: `Bearer ${token}` },
      }));
      assert.equal(first.status, 200);
      const payload = await first.json() as { briefs: { brand: string; program: string; budget: string; contactEmail: string }[]; email: { configured: boolean; to: string } };
      assert.equal(payload.email.configured, false);
      assert.equal(payload.email.to, KAMRON_NOTIFY_EMAIL);
      assert.equal(payload.briefs.some((item) => item.brand === "Route Soap" && item.program === "inquire" && item.budget === "Under $1,000" && item.contactEmail === "june.buyer@routesoap.test"), true);
      const second = await listBriefs(new Request("http://localhost/api/bot/briefs", {
        headers: { authorization: `Bearer ${token}` },
      }));
      const again = await second.json() as { briefs: { brand: string }[] };
      assert.equal(again.briefs.some((item) => item.brand === "Route Soap"), false);
    } finally {
      if (previousPath === undefined) delete process.env.PORTAL_SQLITE_PATH;
      else process.env.PORTAL_SQLITE_PATH = previousPath;
      for (const suffix of ["", "-shm", "-wal"]) {
        try { unlinkSync(`${file}${suffix}`); } catch { /* already gone */ }
      }
    }
  });
});
