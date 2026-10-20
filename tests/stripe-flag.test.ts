import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { createInvoice, createPaymentLink, createSubscription, stripeLiveEnabled } from "../src/lib/stripe-billing";
import { admin, openTestDb } from "./harness";

describe("stripe flag", { concurrency: 1 }, () => {
let db: PortalDb;
before(() => {
  db = openTestDb();
});

test("stripe payment links, subscriptions, and invoices stay off until live keys exist", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
  const previousEnabled = process.env.STRIPE_ENABLED;
  const previousKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_ENABLED;
  delete process.env.STRIPE_SECRET_KEY;
  let called = 0;
  const fetchImpl: typeof fetch = async () => {
    called += 1;
    return new Response("{}", { status: 200 });
  };
  try {
    assert.equal(stripeLiveEnabled(), false);
    for (const result of [
      await createPaymentLink({ priceId: "price_hosted" }, fetchImpl),
      await createSubscription({ customerId: "cus_test", priceId: "price_hosted" }, fetchImpl),
      await createInvoice({ customerId: "cus_test" }, fetchImpl),
    ]) {
      assert.equal(result.ok, false);
      assert.equal(result.charged, false);
      if (!result.ok) assert.equal(result.error, "Stripe is off. Nothing was charged.");
    }
    assert.equal(called, 0);
    const missingPrice = await createPaymentLink({ priceId: "" }, fetchImpl);
    assert.equal(missingPrice.ok, false);
    if (!missingPrice.ok) assert.equal(missingPrice.status, 400);
    assert.equal(called, 0);

    process.env.STRIPE_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_not_live";
    assert.equal(stripeLiveEnabled(), true);
    const bodies: string[] = [];
    const liveFetch: typeof fetch = async (input, init) => {
      called += 1;
      bodies.push(String(init?.body ?? ""));
      const url = String(input);
      const id = url.endsWith("/payment_links") ? "plink_123" : url.endsWith("/subscriptions") ? "sub_123" : "in_123";
      return new Response(JSON.stringify({ id, url: "https://pay.stripe.com/example" }), { status: 200 });
    };
    const link = await createPaymentLink({ priceId: "price_hosted" }, liveFetch);
    const subscription = await createSubscription({ customerId: "cus_test", priceId: "price_hosted" }, liveFetch);
    const invoice = await createInvoice({ customerId: "cus_test" }, liveFetch);
    assert.equal(link.ok && link.charged === false && link.kind === "payment_link" && link.id === "plink_123", true);
    assert.equal(subscription.ok && subscription.kind === "subscription" && subscription.charged === false, true);
    assert.equal(invoice.ok && invoice.kind === "invoice" && invoice.charged === false, true);
    assert.match(decodeURIComponent(bodies[0] ?? ""), /line_items\[0\]\[price\]=price_hosted/);
    assert.match(decodeURIComponent(bodies[1] ?? ""), /payment_behavior=default_incomplete/);
    assert.match(decodeURIComponent(bodies[2] ?? ""), /auto_advance=false/);
    assert.equal(JSON.stringify({ link, subscription, invoice }).includes("sk_test_placeholder_not_live"), false);
    const leaked = await createInvoice({ customerId: "cus_test" }, async () => new Response(JSON.stringify({ error: { message: "bad key sk_test_placeholder_not_live" } }), { status: 401 }));
    assert.equal(leaked.ok, false);
    if (!leaked.ok) assert.equal(leaked.error.includes("sk_test_placeholder_not_live"), false);
    assert.equal(readFileSync(path.join(process.cwd(), ".env.example"), "utf8").includes("sk_live"), false);
    assert.equal(readFileSync(path.join(process.cwd(), "src/lib/stripe-billing.ts"), "utf8").includes("sk_live"), false);
  } finally {
    if (previousEnabled == null) delete process.env.STRIPE_ENABLED;
    else process.env.STRIPE_ENABLED = previousEnabled;
    if (previousKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  }
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
