import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creatorAccounts, creatorPurchases, stripeWebhookEvents } from "../src/db/schema";
import { getDealForViewer } from "../src/lib/queries";
import {
  checkoutReturnUrls,
  createBillingPortalSession,
  createCheckoutSession,
  handleStripeWebhook,
  paymentsEnabled,
  readCreatorBilling,
  recordStripeEvent,
  signStripePayload,
} from "../src/lib/payments";
import { BILLING_PORTAL_FALLBACK_URL, PAYMENT_OFFERS } from "../src/lib/payments-config";
import { admin, openTestDb } from "./harness";

const SECRET = "rk_test_restricted_placeholder";
const WEBHOOK_SECRET = "whsec_test_placeholder";

const EXPECTED: Record<string, { productId: string; prices: Record<string, { priceId: string; amountCents: number }> }> = {
  plus: {
    productId: "prod_VTdB5ZhL2EISRu",
    prices: {
      month: { priceId: "price_1USge24Qt4QNnGtbzVyAvTzx", amountCents: 1900 },
      year: { priceId: "price_1USge14Qt4QNnGtbMn9OrVlO", amountCents: 19000 },
    },
  },
  pro: {
    productId: "prod_VTdCXTD9zLJy1c",
    prices: {
      month: { priceId: "price_1USge14Qt4QNnGtbEdLVLq31", amountCents: 3900 },
      year: { priceId: "price_1USge14Qt4QNnGtbVNVCjxMl", amountCents: 39000 },
    },
  },
  business: {
    productId: "prod_VTdDIgUpQfQIDM",
    prices: {
      month: { priceId: "price_1USge14Qt4QNnGtbVilv7y1G", amountCents: 19900 },
      year: { priceId: "price_1USge14Qt4QNnGtbfuda9E0h", amountCents: 199000 },
    },
  },
  media_kit_build: {
    productId: "prod_VTdFlV7vPpOV8r",
    prices: { one_time: { priceId: "price_1USge14Qt4QNnGtbBc2n8AMS", amountCents: 14900 } },
  },
  rate_card_build: {
    productId: "prod_VTdFZikKAo5gxC",
    prices: { one_time: { priceId: "price_1USge14Qt4QNnGtbrhvFiG9Z", amountCents: 7900 } },
  },
  media_kit_bundle: {
    productId: "prod_VTdFAnFv3tosEN",
    prices: { one_time: { priceId: "price_1USge14Qt4QNnGtbbYPnHYlR", amountCents: 19900 } },
  },
  contract_review: {
    productId: "prod_VTdGztC8GOI7te",
    prices: { one_time: { priceId: "price_1USge64Qt4QNnGtbHkGoim98", amountCents: 12500 } },
  },
  starter_kit_basic: {
    productId: "prod_VTdGZ48TNRphgo",
    prices: { one_time: { priceId: "price_1USge74Qt4QNnGtbk2AI0l8o", amountCents: 14900 } },
  },
  starter_kit_pro: {
    productId: "prod_VTdGw0hmEhSrFf",
    prices: { one_time: { priceId: "price_1USge14Qt4QNnGtbK1uy1sPg", amountCents: 29900 } },
  },
  starter_kit_plus: {
    productId: "prod_VTdH2qGBfTyHj7",
    prices: { one_time: { priceId: "price_1USge14Qt4QNnGtbQGHpC9IL", amountCents: 49900 } },
  },
};

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

async function kosblingSame(db: PortalDb, drafts: number | undefined, events: number) {
  const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
  assert.equal(kosblingAfter?.workflowStage, "draft_due");
  assert.equal(kosblingAfter?.visibleToCreator, true);
  assert.equal(kosblingAfter?.brand, "KOSBLING");
  assert.equal(kosblingAfter?.contact, null);
  assert.equal(kosblingAfter?.drafts.length, drafts);
  assert.equal(kosblingAfter?.contracts.length, 0);
  assert.equal(kosblingAfter?.stageEvents?.length, events);
}

describe("creator checkout", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("payments stay off, price ids live in config, and checkout uses the signed-in email", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const drafts = kosblingBefore?.drafts.length;
    const events = kosblingBefore?.stageEvents?.length ?? 0;
    const previous = {
      PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      APP_BASE_URL: process.env.APP_BASE_URL,
    };
    let called = 0;
    const fetchImpl: typeof fetch = async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    };
    try {
      delete process.env.PAYMENTS_ENABLED;
      delete process.env.STRIPE_SECRET_KEY;
      assert.equal(paymentsEnabled(), false);
      process.env.PAYMENTS_ENABLED = "false";
      assert.equal(paymentsEnabled(), false);
      process.env.PAYMENTS_ENABLED = "TRUE";
      assert.equal(paymentsEnabled(), false);
      process.env.STRIPE_SECRET_KEY = SECRET;
      const blocked = await createCheckoutSession({
        offerId: "plus",
        interval: "month",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
      }, fetchImpl);
      assert.equal(blocked.ok, false);
      assert.equal(blocked.calledStripe, false);
      const portalOff = await createBillingPortalSession({ customerId: "cus_ready" }, fetchImpl);
      assert.equal(portalOff.url, BILLING_PORTAL_FALLBACK_URL);
      assert.equal(portalOff.calledStripe, false);
      assert.equal(called, 0);

      process.env.PAYMENTS_ENABLED = "true";
      delete process.env.STRIPE_SECRET_KEY;
      const missingKey = await createCheckoutSession({
        offerId: "plus",
        interval: "month",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
      }, fetchImpl);
      assert.equal(missingKey.calledStripe, false);
      assert.equal(called, 0);

      process.env.STRIPE_SECRET_KEY = SECRET;
      process.env.APP_BASE_URL = "https://mommamari.com/portal";
      const returns = checkoutReturnUrls();
      assert.equal(returns.successUrl, "https://mommamari.com/portal?checkout=success");
      assert.equal(returns.cancelUrl, "https://mommamari.com/portal");
      assert.equal(checkoutReturnUrls("https://mommamari.com").successUrl, "https://mommamari.com/portal?checkout=success");
      assert.equal(checkoutReturnUrls("http://localhost:43123").cancelUrl, "http://localhost:43123");

      const bodies: string[] = [];
      const headers: Record<string, string>[] = [];
      const urls: string[] = [];
      const liveFetch: typeof fetch = async (input, init) => {
        called += 1;
        urls.push(String(input));
        bodies.push(String(init?.body ?? ""));
        headers.push((init?.headers ?? {}) as Record<string, string>);
        const checkout = String(input).endsWith("/checkout/sessions");
        return new Response(JSON.stringify({ id: checkout ? "cs_123" : "bps_123", url: `https://checkout.stripe.com/${called}` }), { status: 200 });
      };
      const session = await createCheckoutSession({
        offerId: "plus",
        interval: "year",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
      }, liveFetch);
      assert.equal(session.ok, true);
      if (session.ok) assert.equal(session.url, "https://checkout.stripe.com/1");
      const decoded = decodeURIComponent(bodies[0] ?? "");
      assert.match(decoded, /mode=subscription/);
      assert.match(decoded, /customer_email=mmaclamroc@gmail.com/);
      assert.match(decoded, /client_reference_id=mariclare/);
      assert.match(decoded, /line_items\[0\]\[price\]=price_1USge14Qt4QNnGtbMn9OrVlO/);
      assert.match(decoded, /success_url=https:\/\/mommamari\.com\/portal\?checkout=success/);
      assert.match(decoded, /cancel_url=https:\/\/mommamari\.com\/portal(?:&|$)/);
      assert.match(decoded, /metadata\[plan\]=plus/);
      assert.equal(decoded.includes("customer="), false);
      assert.equal(headers[0]?.Authorization, `Bearer ${SECRET}`);
      assert.equal(JSON.stringify(session).includes(SECRET), false);

      const existing = await createCheckoutSession({
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        customerId: "cus_ready",
      }, liveFetch);
      assert.equal(existing.ok, true);
      const kitBody = decodeURIComponent(bodies[1] ?? "");
      assert.match(kitBody, /mode=payment/);
      assert.match(kitBody, /customer=cus_ready/);
      assert.match(kitBody, /line_items\[0\]\[price\]=price_1USge14Qt4QNnGtbBc2n8AMS/);
      assert.equal(kitBody.includes("customer_email="), false);

      const portal = await createBillingPortalSession({ customerId: "cus_ready" }, liveFetch);
      assert.equal(portal.calledStripe, true);
      assert.equal(portal.url, "https://checkout.stripe.com/3");
      assert.match(decodeURIComponent(bodies[2] ?? ""), /customer=cus_ready/);
      assert.match(decodeURIComponent(bodies[2] ?? ""), /return_url=https:\/\/mommamari\.com\/portal\/billing/);

      const failed = await createBillingPortalSession({ customerId: "cus_ready" }, async () => new Response(JSON.stringify({ error: { message: `bad key ${SECRET}` } }), { status: 401 }));
      assert.equal(failed.url, BILLING_PORTAL_FALLBACK_URL);
      assert.equal(failed.calledStripe, true);
      const noCustomer = await createBillingPortalSession({ customerId: null }, fetchImpl);
      assert.equal(noCustomer.calledStripe, false);
      assert.equal(noCustomer.url, BILLING_PORTAL_FALLBACK_URL);

      const unknown = await createCheckoutSession({
        offerId: "nope",
        interval: "month",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
      }, fetchImpl);
      assert.equal(unknown.calledStripe, false);
      assert.deepEqual(urls, [
        "https://api.stripe.com/v1/checkout/sessions",
        "https://api.stripe.com/v1/checkout/sessions",
        "https://api.stripe.com/v1/billing_portal/sessions",
      ]);
      assert.equal(called, 3);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
    }

    assert.equal(PAYMENT_OFFERS.length, Object.keys(EXPECTED).length);
    const priceIds: string[] = [];
    for (const offer of PAYMENT_OFFERS) {
      const expected = EXPECTED[offer.id];
      assert.ok(expected);
      assert.equal(offer.productId, expected.productId);
      for (const price of offer.prices) {
        assert.equal(price.priceId, expected.prices[price.interval]?.priceId);
        assert.equal(price.amountCents, expected.prices[price.interval]?.amountCents);
        priceIds.push(price.priceId);
      }
    }
    assert.equal(new Set(priceIds).size, priceIds.length);
    const config = source("src/lib/payments-config.ts");
    const scattered = [
      "src/lib/payments.ts",
      "src/app/billing/page.tsx",
      "src/components/billing-offers.tsx",
      "src/app/billing-actions.ts",
      "src/app/api/stripe/webhook/route.ts",
    ];
    for (const priceId of priceIds) {
      assert.equal(config.includes(priceId), true);
      for (const file of scattered) assert.equal(source(file).includes(priceId), false);
    }
    assert.equal(config.includes(BILLING_PORTAL_FALLBACK_URL), true);
    const actions = source("src/app/billing-actions.ts");
    assert.match(actions, /email: viewer\.email/);
    assert.equal(actions.includes("formData.get(\"email\")"), false);
    assert.match(source("src/components/billing-offers.tsx"), /Coming soon/);
    assert.match(source("src/components/billing-offers.tsx"), /aria-label=\{`\$\{plan\.name\} billing period`\}/);
    assert.match(source("src/app/billing/page.tsx"), /Manage billing/);
    assert.match(source("src/components/checkout-success-note.tsx"), /Checkout finished/);
    assert.match(source("src/app/page.tsx"), /checkout=success/);
    assert.match(source("src/app/onboarding/page.tsx"), /CheckoutSuccessNote/);
    assert.match(source("src/app/api/stripe/webhook/route.ts"), /handleStripeWebhook/);
    assert.match(source("src/lib/payments.ts"), /process\.env\.STRIPE_SECRET_KEY/);
    assert.match(source("src/lib/payments.ts"), /PAYMENTS_ENABLED === "true"/);
    for (const file of ["src/lib/payments.ts", "src/lib/payments-config.ts", "src/app/billing/page.tsx", ".env.example"]) {
      assert.equal(source(file).includes("sk_live"), false);
      assert.equal(source(file).includes("rk_live"), false);
    }
    const migration = source("drizzle/0040_creator_payments.sql");
    assert.equal(migration.toLowerCase().includes("update deals"), false);
    assert.match(migration, /KOSBLING/);
    await kosblingSame(db, drafts, events);
  });

  test("a signed webhook records the plan once and ignores a bad signature", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const drafts = kosblingBefore?.drafts.length;
    const events = kosblingBefore?.stageEvents?.length ?? 0;
    const previous = process.env.STRIPE_WEBHOOK_SECRET;
    const now = 1_700_000_000;
    const plusPrice = "price_1USge24Qt4QNnGtbzVyAvTzx";
    const proYear = "price_1USge14Qt4QNnGtbVNVCjxMl";
    const kitPrice = "price_1USge14Qt4QNnGtbBc2n8AMS";
    try {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const unconfigured = await handleStripeWebhook(new Request("https://mommamari.com/portal/api/stripe/webhook", { method: "POST", body: "{}" }), db, now);
      assert.equal(unconfigured.status, 503);
      assert.equal((await db.select().from(stripeWebhookEvents)).length, 0);

      process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
      const subscription = {
        id: "evt_sub_new",
        type: "customer.subscription.updated",
        created: 200,
        data: {
          object: {
            id: "sub_123",
            customer: "cus_mari",
            status: "active",
            metadata: { creator_id: "mariclare", plan: "plus", interval: "month" },
            items: { data: [{ price: { id: plusPrice } }] },
          },
        },
      };
      const payload = JSON.stringify(subscription);
      const signed = await handleStripeWebhook(new Request("https://mommamari.com/portal/api/stripe/webhook", {
        method: "POST",
        body: payload,
        headers: { "stripe-signature": signStripePayload(payload, WEBHOOK_SECRET, now) },
      }), db, now);
      assert.equal(signed.status, 200);
      assert.equal(signed.body.duplicate, false);
      let billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.summary, "Plus · Monthly · Active");
      assert.equal(billing.stripeCustomerId, "cus_mari");
      const account = (await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, "mariclare")))[0];
      assert.equal(account?.plan, "Core");
      assert.equal(account?.subscriptionPlan, "plus");

      const again = await recordStripeEvent(db, subscription);
      assert.equal(again.ok && again.duplicate, true);
      assert.equal((await db.select().from(stripeWebhookEvents)).length, 1);
      billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.subscriptionPlan, "plus");

      const older = await recordStripeEvent(db, {
        id: "evt_sub_old",
        type: "customer.subscription.updated",
        created: 100,
        data: {
          object: {
            id: "sub_123",
            customer: "cus_mari",
            status: "canceled",
            metadata: { creator_id: "mariclare", plan: "business" },
            items: { data: [{ price: "price_1USge14Qt4QNnGtbVilv7y1G" }] },
          },
        },
      });
      assert.equal(older.ok && older.duplicate, false);
      billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.subscriptionStatus, "active");
      assert.equal(billing.subscriptionPlan, "plus");

      const upgraded = await recordStripeEvent(db, {
        id: "evt_sub_pro",
        type: "customer.subscription.updated",
        created: 300,
        data: {
          object: {
            id: "sub_123",
            customer: "cus_mari",
            status: "active",
            metadata: {},
            items: { data: [{ price: { id: proYear } }] },
          },
        },
      });
      assert.equal(upgraded.ok && upgraded.duplicate, false);
      billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.summary, "Pro · Yearly · Active");

      const tampered = payload.replace("active", "canceled");
      const rejected = await handleStripeWebhook(new Request("https://mommamari.com/portal/api/stripe/webhook", {
        method: "POST",
        body: tampered,
        headers: { "stripe-signature": signStripePayload(payload, WEBHOOK_SECRET, now) },
      }), db, now);
      assert.equal(rejected.status, 400);
      billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.subscriptionStatus, "active");

      const stale = await handleStripeWebhook(new Request("https://mommamari.com/portal/api/stripe/webhook", {
        method: "POST",
        body: payload,
        headers: { "stripe-signature": signStripePayload(payload, WEBHOOK_SECRET, now - 301) },
      }), db, now);
      assert.equal(stale.status, 400);

      const kitPayload = {
        id: "evt_kit",
        type: "checkout.session.completed",
        created: 400,
        data: {
          object: {
            id: "cs_kit",
            mode: "payment",
            customer: "cus_mari",
            customer_email: "someone-else@example.com",
            metadata: { creator_id: "mariclare", offer: "media_kit_build", price_id: kitPrice, interval: "one_time" },
          },
        },
      };
      const kit = await recordStripeEvent(db, kitPayload);
      assert.equal(kit.ok && kit.duplicate, false);
      const kitAgain = await recordStripeEvent(db, kitPayload);
      assert.equal(kitAgain.ok && kitAgain.duplicate, true);
      billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.subscriptionPlan, "pro");
      assert.equal(billing.subscriptionStatus, "active");
      assert.deepEqual(billing.purchases.map((purchase) => purchase.name), ["Media Kit Build"]);
      assert.equal((await db.select().from(creatorPurchases)).length, 1);
      const abby = await readCreatorBilling(db, "abby");
      assert.equal(abby.subscriptionPlan, null);
      assert.equal(abby.purchases.length, 0);

      const stranger = await recordStripeEvent(db, {
        id: "evt_stranger",
        type: "checkout.session.completed",
        created: 500,
        data: {
          object: {
            id: "cs_stranger",
            mode: "subscription",
            customer: "cus_other",
            customer_email: "mmaclamroc@gmail.com",
            metadata: { creator_id: "not-a-creator", plan: "business", interval: "month" },
            client_reference_id: "not-a-creator",
          },
        },
      });
      assert.equal(stranger.ok && stranger.duplicate, false);
      billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.subscriptionPlan, "pro");
      assert.equal((await db.select().from(creatorAccounts).where(eq(creatorAccounts.creatorId, "not-a-creator"))).length, 0);

      const ended = await recordStripeEvent(db, {
        id: "evt_deleted",
        type: "customer.subscription.deleted",
        created: 600,
        data: {
          object: {
            id: "sub_123",
            customer: "cus_mari",
            status: "canceled",
            metadata: { creator_id: "mariclare" },
            items: { data: [{ price: { id: proYear } }] },
          },
        },
      });
      assert.equal(ended.ok && ended.duplicate, false);
      billing = await readCreatorBilling(db, "mariclare");
      assert.equal(billing.subscriptionStatus, "canceled");
      assert.equal(billing.subscriptionPlan, "pro");
    } finally {
      if (previous == null) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = previous;
    }
    await kosblingSame(db, drafts, events);
  });
});
