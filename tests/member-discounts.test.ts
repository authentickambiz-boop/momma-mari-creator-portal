import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creatorPurchases, fulfillmentOrders } from "../src/db/schema";
import { beginCreatorCheckout, checkoutStatusNote, createCheckoutSession, oneTimePriceNote } from "../src/lib/payments";
import {
  MEMBER_ONE_TIME_PERCENT_OFF,
  memberCouponId,
  memberOneTimePercent,
  memberPriceCents,
  memberServiceIncluded,
  oneTimeMemberNote,
} from "../src/lib/payments-config";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

const SECRET = "rk_live_member_discount_test";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("member discounts", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("each plan has its own one-time rate, and Business is queued without Checkout", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const drafts = kosblingBefore?.drafts.length;
    const events = kosblingBefore?.stageEvents?.length ?? 0;
    const previous = {
      PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    };
    try {
      delete process.env.PAYMENTS_ENABLED;
      delete process.env.STRIPE_SECRET_KEY;
      assert.deepEqual(MEMBER_ONE_TIME_PERCENT_OFF, { plus: 10, pro: 20, business: 100 });
      assert.equal(memberOneTimePercent("plus", "active"), MEMBER_ONE_TIME_PERCENT_OFF.plus);
      assert.equal(memberOneTimePercent("pro", "trialing"), MEMBER_ONE_TIME_PERCENT_OFF.pro);
      assert.equal(memberServiceIncluded(memberOneTimePercent("business", "active")), true);
      assert.equal(memberOneTimePercent("plus", "canceled"), 0);
      assert.equal(memberOneTimePercent("business", "past_due"), 0);
      assert.equal(memberOneTimePercent(null, "active"), 0);
      assert.equal(memberPriceCents(14900, MEMBER_ONE_TIME_PERCENT_OFF.plus), 13410);
      assert.equal(memberPriceCents(7900, MEMBER_ONE_TIME_PERCENT_OFF.pro), 6320);
      assert.equal(memberPriceCents(19900, MEMBER_ONE_TIME_PERCENT_OFF.business), 0);
      assert.match(oneTimeMemberNote(), /Plus members get 10% off/);
      assert.match(oneTimeMemberNote(), /Pro members get 20% off/);
      assert.match(oneTimeMemberNote(), /Business members get them included/);
      assert.match(oneTimePriceNote("$149", 14900, 10), /You pay \$134\.10/);
      assert.match(oneTimePriceNote("$149", 14900, 100) ?? "", /Included with your plan/);
      assert.equal(checkoutStatusNote("included"), "Included with your plan. It is in the fulfillment queue. Nothing was charged.");

      const blocked = await beginCreatorCheckout(db, {
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
      }, async () => {
        throw new Error("Stripe was called while payments are off");
      });
      assert.equal(blocked.ok, false);
      assert.equal(blocked.calledStripe, false);
      assert.equal((await db.select().from(fulfillmentOrders)).length, 0);

      process.env.PAYMENTS_ENABLED = "true";
      const included = await beginCreatorCheckout(db, {
        offerId: "rate_card_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
      }, async () => {
        throw new Error("Business inclusion must not call Stripe");
      });
      assert.equal(included.ok, true);
      assert.equal(included.calledStripe, false);
      if (included.ok) assert.equal(included.url, "/billing?checkout=included");
      const purchases = await db.select().from(creatorPurchases);
      assert.equal(purchases.length, 1);
      assert.equal(purchases[0]?.amountCents, 0);
      assert.equal(purchases[0]?.offerId, "rate_card_build");
      const orders = await db.select().from(fulfillmentOrders);
      assert.equal(orders.length, 1);
      assert.equal(orders[0]?.status, "queued");
      assert.equal(orders[0]?.creatorId, "mariclare");
      assert.equal(orders[0]?.product, "rate_card_build");
      assert.equal(orders[0]?.purchaseId, purchases[0]?.id);

      const again = await beginCreatorCheckout(db, {
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "trialing",
      }, async () => {
        throw new Error("Business inclusion must not call Stripe");
      });
      assert.equal(again.ok, true);
      assert.equal((await db.select().from(fulfillmentOrders)).length, 2);

      process.env.STRIPE_SECRET_KEY = SECRET;
      const calls: { url: string; body: string }[] = [];
      const fetchImpl: typeof fetch = async (input, init) => {
        const url = String(input);
        calls.push({ url, body: decodeURIComponent(String(init?.body ?? "")) });
        if (url.endsWith("/coupons")) {
          const duplicate = calls.filter((call) => call.url.endsWith("/coupons")).length > 1;
          if (duplicate) {
            return new Response(JSON.stringify({ error: { code: "resource_already_exists", message: "Coupon already exists." } }), { status: 400 });
          }
          return new Response(JSON.stringify({ id: "coupon_ok" }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "cs_member", url: "https://checkout.stripe.com/member" }), { status: 200 });
      };

      const plus = await beginCreatorCheckout(db, {
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        customerId: "cus_ready",
        memberPlan: "plus",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(plus.ok, true);
      assert.equal(plus.calledStripe, true);
      assert.match(calls[0]?.body ?? "", new RegExp(`percent_off=${MEMBER_ONE_TIME_PERCENT_OFF.plus}(?:&|$)`));
      assert.match(calls[0]?.body ?? "", new RegExp(`id=${memberCouponId("plus", MEMBER_ONE_TIME_PERCENT_OFF.plus)}`));
      assert.match(calls[1]?.body ?? "", /mode=payment/);
      assert.match(calls[1]?.body ?? "", new RegExp(`discounts\\[0\\]\\[coupon\\]=${memberCouponId("plus", 10)}`));
      assert.match(calls[1]?.body ?? "", /line_items\[0\]\[price\]=price_1USge14Qt4QNnGtbBc2n8AMS/);
      assert.equal((calls[1]?.body ?? "").includes("metadata[plan]=plus"), false);

      const plusAgain = await createCheckoutSession({
        offerId: "contract_review",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "plus",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(plusAgain.ok, true);
      assert.equal(calls.filter((call) => call.url.endsWith("/checkout/sessions")).length, 2);

      const pro = await beginCreatorCheckout(db, {
        offerId: "starter_kit_basic",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "pro",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(pro.ok, true);
      const proCoupon = calls.filter((call) => call.url.endsWith("/coupons")).at(-1);
      assert.match(proCoupon?.body ?? "", /percent_off=20(?:&|$)/);
      assert.match(proCoupon?.body ?? "", new RegExp(`id=${memberCouponId("pro", 20)}`));

      const lapsed = await beginCreatorCheckout(db, {
        offerId: "media_kit_bundle",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "plus",
        memberStatus: "canceled",
      }, fetchImpl);
      assert.equal(lapsed.ok, true);
      const lapsedBody = calls.at(-1)?.body ?? "";
      assert.equal(lapsedBody.includes("discounts["), false);
      assert.equal(calls.at(-1)?.url.endsWith("/checkout/sessions"), true);

      const subscribe = await beginCreatorCheckout(db, {
        offerId: "plus",
        interval: "month",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "plus",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(subscribe.ok, true);
      const subscribeBody = calls.at(-1)?.body ?? "";
      assert.match(subscribeBody, /mode=subscription/);
      assert.equal(subscribeBody.includes("discounts["), false);

      const directIncluded = await createCheckoutSession({
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(directIncluded.ok, false);
      assert.equal(directIncluded.calledStripe, false);
      assert.equal((await db.select().from(fulfillmentOrders).where(eq(fulfillmentOrders.product, "media_kit_build"))).length, 1);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
    }

    const offers = source("src/components/billing-offers.tsx");
    assert.match(offers, /Coming soon/);
    assert.equal(offers.includes("10%"), false);
    assert.equal(offers.includes("20%"), false);
    assert.match(source("src/app/billing/page.tsx"), /oneTimeMemberNote\(\)/);
    assert.match(source("src/app/billing-actions.ts"), /memberPlan: billing\.subscriptionPlan/);
    assert.match(source("src/lib/payments-config.ts"), /MEMBER_ONE_TIME_PERCENT_OFF/);
    assert.equal(process.env.PAYMENTS_ENABLED === "true", false);
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
