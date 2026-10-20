import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { asc, eq } from "drizzle-orm";
import { GET as listOrders, POST as claimOrder } from "../src/app/api/bot/orders/route";
import { POST as deliverOrder } from "../src/app/api/bot/orders/[id]/deliver/route";
import type { PortalDb } from "../src/db/index";
import { fulfillmentOrders } from "../src/db/schema";
import { BRAND_CREDIT, BRAND_LOGO_PATH, deliveryCarriesBranding, renderMediaKit, renderRateCard } from "../src/lib/branding";
import { claimFulfillmentOrder, deliverFulfillmentOrder, FULFILLMENT_DUE_DAYS, fulfillmentDueOn, listFulfillmentOrders, listQueuedOrders } from "../src/lib/fulfillment-orders";
import { recordStripeEvent } from "../src/lib/payments";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function paidCheckout(id: string, product: string, priceId: string, paymentStatus: string | null, created = 1_700_000_000) {
  return {
    id,
    type: "checkout.session.completed",
    created,
    data: {
      object: {
        id: `cs_${id}`,
        mode: "payment",
        payment_status: paymentStatus,
        customer: "cus_mari",
        metadata: { creator_id: "mariclare", offer: product, price_id: priceId, interval: "one_time" },
      },
    },
  };
}

describe("fulfillment orders", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("a paid one-time purchase is queued for the bots, and delivery keeps the Momma Mari mark", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const drafts = kosblingBefore?.drafts.length;
    const events = kosblingBefore?.stageEvents?.length ?? 0;
    const previous = process.env.PAYMENTS_ENABLED;
    try {
      delete process.env.PAYMENTS_ENABLED;
      const blocked = await recordStripeEvent(db, paidCheckout("evt_off", "media_kit_build", "price_1USge14Qt4QNnGtbBc2n8AMS", "paid"));
      assert.equal(blocked.ok, true);
      assert.equal((await db.select().from(fulfillmentOrders)).length, 0);
      const hidden = await listQueuedOrders(db);
      assert.equal(hidden.ok, false);
      if (!hidden.ok) assert.equal(hidden.status, 503);
      const refused = await claimFulfillmentOrder(db);
      assert.equal(refused.ok, false);
      assert.deepEqual(await listFulfillmentOrders(db, mariclare), []);

      const missing = await listOrders(new Request("http://localhost/api/bot/orders"));
      assert.equal(missing.status, 401);
      const missingClaim = await claimOrder(new Request("http://localhost/api/bot/orders", { method: "POST", body: "{}" }));
      assert.equal(missingClaim.status, 401);
      const missingDeliver = await deliverOrder(new Request("http://localhost/api/bot/orders/x/deliver", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "x" }) });
      assert.equal(missingDeliver.status, 401);

      process.env.PAYMENTS_ENABLED = "true";
      const unpaid = await recordStripeEvent(db, paidCheckout("evt_unpaid", "rate_card_build", "price_1USge14Qt4QNnGtbrhvFiG9Z", "unpaid"));
      assert.equal(unpaid.ok, true);
      assert.equal((await db.select().from(fulfillmentOrders)).length, 0);
      const subscription = await recordStripeEvent(db, {
        id: "evt_plan",
        type: "checkout.session.completed",
        created: 1_700_000_100,
        data: {
          object: {
            id: "cs_plan",
            mode: "subscription",
            payment_status: "paid",
            customer: "cus_mari",
            metadata: { creator_id: "mariclare", offer: "plus", plan: "plus", interval: "month", price_id: "price_1USge24Qt4QNnGtbzVyAvTzx" },
          },
        },
      });
      assert.equal(subscription.ok, true);
      assert.equal((await db.select().from(fulfillmentOrders)).length, 0);

      const products = [
        ["evt_kit", "media_kit_build", "price_1USge14Qt4QNnGtbBc2n8AMS"],
        ["evt_rate", "rate_card_build", "price_1USge14Qt4QNnGtbrhvFiG9Z"],
        ["evt_bundle", "media_kit_bundle", "price_1USge14Qt4QNnGtbbYPnHYlR"],
        ["evt_review", "contract_review", "price_1USge64Qt4QNnGtbHkGoim98"],
        ["evt_basic", "starter_kit_basic", "price_1USge74Qt4QNnGtbk2AI0l8o"],
        ["evt_pro", "starter_kit_pro", "price_1USge14Qt4QNnGtbK1uy1sPg"],
        ["evt_plus", "starter_kit_plus", "price_1USge14Qt4QNnGtbQGHpC9IL"],
      ] as const;
      for (const [index, [eventId, product, priceId]] of products.entries()) {
        const saved = await recordStripeEvent(db, paidCheckout(eventId, product, priceId, "paid", 1_700_000_200 + index));
        assert.equal(saved.ok && saved.duplicate, false);
      }
      const again = await recordStripeEvent(db, paidCheckout("evt_kit", "media_kit_build", "price_1USge14Qt4QNnGtbBc2n8AMS", "paid"));
      assert.equal(again.ok && again.duplicate, true);
      const rows = await db.select().from(fulfillmentOrders).orderBy(asc(fulfillmentOrders.createdAt));
      assert.equal(rows.length, products.length);
      assert.equal(rows[0]?.creatorId, "mariclare");
      assert.equal(rows[0]?.product, "media_kit_build");
      assert.equal(rows[0]?.status, "queued");
      assert.equal(rows[0]?.dueOn, fulfillmentDueOn(rows[0]?.createdAt ?? ""));
      assert.equal(FULFILLMENT_DUE_DAYS, 5);
      const owner = await listFulfillmentOrders(db, admin);
      assert.equal(owner.length, products.length);
      assert.equal(owner[0]?.creatorName, "MariClare");
      assert.equal(owner[0]?.productName, "Media Kit Build");
      assert.equal(owner[0]?.statusLabel, "Queued");

      const queued = await listQueuedOrders(db);
      assert.equal(queued.ok && queued.orders.length, products.length);
      const first = await claimFulfillmentOrder(db);
      assert.equal(first.ok, true);
      if (!first.ok) return;
      assert.equal(first.order.product, "media_kit_build");
      assert.equal(first.order.status, "in_progress");
      assert.equal(first.order.branding.credit, BRAND_CREDIT);
      assert.equal(first.order.branding.logo, BRAND_LOGO_PATH);
      const secondClaim = await claimFulfillmentOrder(db, first.order.id);
      assert.equal(secondClaim.ok, false);
      if (!secondClaim.ok) assert.equal(secondClaim.status, 409);

      const early = await deliverFulfillmentOrder(db, rows[1]?.id ?? "", { url: "https://files.example/rate.pdf" });
      assert.equal(early.ok, false);
      if (!early.ok) assert.equal(early.error, "Claim the order before delivering it.");
      const missingFile = await deliverFulfillmentOrder(db, first.order.id, {});
      assert.equal(missingFile.ok, false);
      if (!missingFile.ok) assert.equal(missingFile.error, "Add a file or a link.");

      const kit = renderMediaKit({ creatorName: "MariClare", body: "Home and routines" });
      const rate = renderRateCard({ creatorName: "MariClare", body: "One TikTok is 500" });
      assert.equal(deliveryCarriesBranding(kit), true);
      assert.equal(deliveryCarriesBranding(rate), true);
      assert.match(kit, /momma-mari-kit/);
      assert.match(rate, /momma-mari-rate-card/);
      const delivered = await deliverFulfillmentOrder(db, first.order.id, { filename: "kit.html", body: "Home and routines" });
      assert.equal(delivered.ok, true);
      if (!delivered.ok) return;
      assert.equal(delivered.duplicate, false);
      assert.equal(delivered.order.status, "delivered");
      assert.equal(deliveryCarriesBranding(delivered.order.deliveryBody ?? ""), true);
      assert.match(delivered.order.deliveryBody ?? "", /momma-mari-kit/);
      const repeat = await deliverFulfillmentOrder(db, first.order.id, { url: "https://files.example/other" });
      assert.equal(repeat.ok && repeat.duplicate, true);
      if (repeat.ok) assert.equal(repeat.order.deliveryUrl, null);

      const rateClaim = await claimFulfillmentOrder(db);
      assert.equal(rateClaim.ok && rateClaim.order.product, "rate_card_build");
      if (!rateClaim.ok) return;
      const linked = await deliverFulfillmentOrder(db, rateClaim.order.id, { url: "https://files.example/rate-card.pdf" });
      assert.equal(linked.ok, true);
      if (!linked.ok) return;
      assert.equal(linked.order.deliveryUrl, "https://files.example/rate-card.pdf");
      assert.equal(deliveryCarriesBranding(linked.order.deliveryBody ?? ""), true);

      const stillQueued = await listQueuedOrders(db);
      assert.equal(stillQueued.ok && stillQueued.orders.some((order) => order.product === "media_kit_bundle"), true);
      const bundle = stillQueued.ok ? stillQueued.orders.find((order) => order.product === "media_kit_bundle") : null;
      const bundleClaim = await claimFulfillmentOrder(db, bundle?.id);
      assert.equal(bundleClaim.ok, true);
      if (bundleClaim.ok) {
        const both = await deliverFulfillmentOrder(db, bundleClaim.order.id, { filename: "bundle.txt", body: "Kit and rates" });
        assert.equal(both.ok, true);
        if (both.ok) {
          assert.match(both.order.deliveryBody ?? "", /momma-mari-kit/);
          assert.match(both.order.deliveryBody ?? "", /momma-mari-rate-card/);
        }
      }

      delete process.env.PAYMENTS_ENABLED;
      const late = await recordStripeEvent(db, paidCheckout("evt_late", "contract_review", "price_1USge64Qt4QNnGtbHkGoim98", "paid", 1_700_000_900));
      assert.equal(late.ok, true);
      assert.equal((await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.purchaseId, "cs_evt_late"))).length, 0);
      const paused = await listQueuedOrders(db);
      assert.equal(paused.ok, false);
    } finally {
      if (previous == null) delete process.env.PAYMENTS_ENABLED;
      else process.env.PAYMENTS_ENABLED = previous;
    }

    const dashboard = source("src/app/dashboard/page.tsx");
    assert.match(dashboard, /Fulfillment/);
    assert.match(dashboard, /Payments are off/);
    assert.match(dashboard, /Stripe stays off/);
    assert.match(source("src/app/kit/[slug]/page.tsx"), /BrandingFooter/);
    assert.match(source("src/components/branding-footer.tsx"), /BRAND_CREDIT|mark\.credit/);
    assert.match(source("src/app/api/bot/orders/route.ts"), /botGuard/);
    assert.match(source("src/app/api/bot/orders/[id]/deliver/route.ts"), /botGuard/);
    const migration = source("drizzle/0041_fulfillment_orders.sql");
    assert.equal(migration.toLowerCase().includes("update deals"), false);
    assert.match(migration, /KOSBLING/);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, drafts);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, events);
  });
});
