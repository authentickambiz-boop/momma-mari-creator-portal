import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { brandBillingTerms, brandCrmEntries, deals, gmailBridgeThreads } from "../src/db/schema";
import { formatBrandBrief, saveBrandBrief, type BrandBriefInput } from "../src/lib/brand-brief";
import { boldSignEnabled } from "../src/lib/boldsign";
import { pushEnabled } from "../src/lib/home-screen";
import { stripeInvoicingEnabled } from "../src/lib/invoice-flag";
import { packageCheckoutEnabled } from "../src/lib/package-checkout-flag";
import { paymentsEnabled } from "../src/lib/payments-config";
import { payoutTransfersEnabled } from "../src/lib/payout-flag";
import { REPLY_PROMISE } from "../src/lib/public-site";
import { openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const promise = ["We reply within", "3", "business", "days."].join(" ");
const daysPhrase = ["3", "business", "days"].join(" ");

function sourceFiles(dir: string): string[] {
  const skip = new Set(["node_modules", ".git", ".next", "data", "out", "build", "coverage", "dist"]);
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|md|sql|css|html|json|txt)$/.test(name)) continue;
    found.push(full);
  }
  return found;
}

function brief(overrides: Partial<BrandBriefInput> = {}): BrandBriefInput {
  return {
    brand: "Lumen Soap",
    name: "Pat Lee",
    email: "pat@lumensoap.test",
    creators: ["mariclare"],
    goal: "Clicks",
    deliverables: "1 TikTok",
    budget: "Under $1,000",
    budgetKind: "Paid",
    paymentMethod: "ACH",
    ...overrides,
  };
}

function flagsOff() {
  assert.equal(paymentsEnabled(), false);
  assert.equal(stripeInvoicingEnabled(), false);
  assert.equal(boldSignEnabled(), false);
  assert.equal(pushEnabled(), false);
  assert.equal(payoutTransfersEnabled(), false);
  assert.equal(packageCheckoutEnabled(), false);
}

describe("brand inquiry terms", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("the form has no terms or deposit selects, and the reply promise is one constant", () => {
    const form = source("src/components/brand-brief-form.tsx");
    const page = source("src/app/inquire/page.tsx");
    assert.equal(form.includes('name="paymentTerms"'), false);
    assert.equal(form.includes('name="deposit"'), false);
    assert.equal(form.includes("PAYMENT_TERMS"), false);
    assert.equal(form.includes("Deposit?"), false);
    assert.equal(form.includes("Net 15"), false);
    assert.equal(form.includes("Net 45"), false);
    assert.equal(form.includes("Returning brands"), false);
    assert.equal(form.toLowerCase().includes("minimum"), false);
    assert.equal(form.toLowerCase().includes("floor"), false);
    assert.match(form, /<h2>How payment works<\/h2>/);
    assert.match(form, /New brands pay 50% before filming and 50% when the content posts\. Terms are confirmed in your agreement\./);
    const panel = form.slice(form.indexOf("How payment works"), form.indexOf("Payment method"));
    assert.equal(panel.includes("<input"), false);
    assert.equal(panel.includes("<select"), false);
    assert.equal(panel.includes("<textarea"), false);
    assert.match(form, /\{REPLY_PROMISE\}/);
    assert.match(page, /\$\{REPLY_PROMISE\}/);
    assert.match(page, /<p>\{REPLY_PROMISE\}<\/p>/);
    assert.equal(REPLY_PROMISE, promise);

    const hits = sourceFiles(process.cwd()).filter((file) => source(path.relative(process.cwd(), file)).includes(daysPhrase));
    assert.deepEqual(hits.map((file) => path.relative(process.cwd(), file)), ["src/lib/public-site.ts"]);
    assert.equal(source("src/lib/public-site.ts").split(daysPhrase).length - 1, 1);
  });

  test("a new brand inquiry is stored as deposit first", async () => {
    flagsOff();
    const dealsBefore = (await db.select().from(deals)).length;
    const missingBudget = await saveBrandBrief(db, brief({ brand: "No Budget Soap", email: "pat@nobudgetsoap.test", budget: "  " }));
    assert.equal(missingBudget.ok, false);
    assert.equal((await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, "no budget soap"))).length, 0);

    const saved = await saveBrandBrief(db, brief());
    assert.equal(saved.ok, true);
    const rows = await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, "lumen soap"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.terms, "deposit_first");
    assert.equal(rows[0]?.updatedBy, "inquiry");
    const note = (await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, "lumen soap")))
      .find((row) => row.kind === "inquiry")?.note ?? "";
    assert.match(note, /Payment terms: 50% before filming and 50% when the content posts/);
    assert.equal(note.includes("Net 15"), false);
    assert.equal(note.includes("Net 30"), false);
    assert.equal(note.includes("Net 45"), false);
    assert.equal(/deposit/i.test(note), false);
    const again = await saveBrandBrief(db, brief({ email: "second@lumensoap.test" }));
    assert.equal(again.ok, true);
    const still = await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, "lumen soap"));
    assert.equal(still.length, 1);
    assert.equal(still[0]?.terms, "deposit_first");
    assert.equal(still[0]?.updatedBy, "inquiry");
    assert.equal((await db.select().from(deals)).length, dealsBefore);
    flagsOff();
  });

  test("a payload that picks Net 45 and no deposit is accepted and those values are ignored", async () => {
    const formatted = formatBrandBrief(brief({
      brand: "Ignore Terms Co",
      paymentTerms: "Net 45",
      deposit: "no",
      paymentMethod: "Wire",
    }), "deposit_first");
    assert.match(formatted, /Payment terms: 50% before filming and 50% when the content posts\. Wire/);
    assert.equal(formatted.includes("Net 45"), false);
    assert.equal(/deposit/i.test(formatted), false);

    const saved = await saveBrandBrief(db, brief({
      brand: "Ignore Terms Co",
      email: "ap@ignoreterms.test",
      paymentTerms: "Net 45",
      deposit: "no",
      paymentMethod: "Wire",
    }));
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const rows = await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, "ignore terms co"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.terms, "deposit_first");
    assert.equal(JSON.stringify(rows[0]).includes("Net 45"), false);
    const note = (await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, "ignore terms co")))
      .find((row) => row.kind === "inquiry")?.note ?? "";
    assert.match(note, /50% before filming and 50% when the content posts/);
    assert.match(note, /Wire/);
    assert.equal(note.includes("Net 45"), false);
    assert.equal(note.includes("Deposit:"), false);
    assert.equal(/deposit/i.test(note), false);
    const thread = (await db.select().from(gmailBridgeThreads)).find((row) => row.brand === "Ignore Terms Co");
    assert.equal(thread?.classification, "inquiry");
    assert.equal(thread?.snippet.includes("Net 45"), false);
    assert.equal((thread?.snippet ?? "").includes("Deposit:"), false);
    flagsOff();
  });

  test("an owner-set Net 30 row is left in place", async () => {
    await db.insert(brandBillingTerms).values({
      brandKey: "kept soap",
      terms: "net_30",
      updatedBy: "kamron@mommamari.com",
      updatedAt: "2026-10-21T00:00:00.000Z",
    });
    const saved = await saveBrandBrief(db, brief({
      brand: "Kept Soap",
      email: "ap@keptsoap.test",
      paymentTerms: "Net 45",
      deposit: "no",
    }));
    assert.equal(saved.ok, true);
    const rows = await db.select().from(brandBillingTerms).where(eq(brandBillingTerms.brandKey, "kept soap"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.terms, "net_30");
    assert.equal(rows[0]?.updatedBy, "kamron@mommamari.com");
    assert.equal(rows[0]?.updatedAt, "2026-10-21T00:00:00.000Z");
    const note = (await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, "kept soap")))
      .find((row) => row.kind === "inquiry")?.note ?? "";
    assert.match(note, /Payment terms: Net 30/);
    assert.equal(note.includes("Net 45"), false);
    assert.equal(note.includes("Deposit:"), false);
  });
});
