import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creators, creatorPurchases, fulfillmentOrders } from "../src/db/schema";
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
import { creatorIsSigned, listCreatorSigning, setCreatorSigned } from "../src/lib/signed-creators";
import { admin, mariclare, openTestDb } from "./harness";

const SECRET = "rk_live_member_discount_test";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("member discounts", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("Plus and Pro get their own coupon, and Business and signed creators skip Checkout", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const drafts = kosblingBefore?.drafts.length;
    const events = kosblingBefore?.stageEvents?.length ?? 0;
    const previous = {
      PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      MEMBER_DISCOUNT_PERCENT: process.env.MEMBER_DISCOUNT_PERCENT,
    };
    try {
      delete process.env.PAYMENTS_ENABLED;
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.MEMBER_DISCOUNT_PERCENT;
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
      assert.match(oneTimeMemberNote(), /Signed creators get them included/);
      assert.match(oneTimePriceNote("$149", 14900, 10), /You pay \$134\.10/);
      assert.match(oneTimePriceNote("$149", 14900, 100), /Included with your plan/);
      assert.match(oneTimePriceNote("$149", 14900, 100, true), /Included with your contract/);
      assert.equal(checkoutStatusNote("included"), "Included with your plan or contract. It is in the fulfillment queue. Nothing was charged.");
      assert.equal(await creatorIsSigned(db, "mariclare"), false);

      const refused = await setCreatorSigned(db, mariclare, "mariclare", true);
      assert.equal(refused.ok, false);
      assert.equal(await creatorIsSigned(db, "mariclare"), false);
      assert.deepEqual(await listCreatorSigning(db, mariclare), []);
      const marked = await setCreatorSigned(db, admin, "mariclare", true);
      assert.equal(marked.ok, true);
      assert.equal(await creatorIsSigned(db, "mariclare"), true);
      const roster = await listCreatorSigning(db, admin);
      assert.equal(roster.find((person) => person.id === "mariclare")?.signed, true);
      const missing = await setCreatorSigned(db, admin, "nobody", true);
      assert.equal(missing.ok, false);

      const blocked = await beginCreatorCheckout(db, {
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
        signed: true,
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
        memberPlan: "plus",
        memberStatus: "active",
      }, async () => {
        throw new Error("A signed creator must not call Stripe");
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
      assert.equal(orders[0]?.product, "rate_card_build");

      await setCreatorSigned(db, admin, "mariclare", false);
      assert.equal(await creatorIsSigned(db, "mariclare"), false);

      const business = await beginCreatorCheckout(db, {
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
      }, async () => {
        throw new Error("Business inclusion must not call Stripe");
      });
      assert.equal(business.ok, true);
      assert.equal(business.calledStripe, false);
      if (business.ok) assert.equal(business.url, "/billing?checkout=included");
      assert.equal((await db.select().from(fulfillmentOrders)).length, 2);
      const businessPurchase = (await db.select().from(creatorPurchases)).find((row) => row.offerId === "media_kit_build");
      assert.equal(businessPurchase?.amountCents, 0);

      const trialing = await beginCreatorCheckout(db, {
        offerId: "contract_review",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "trialing",
      }, async () => {
        throw new Error("Business inclusion must not call Stripe");
      });
      assert.equal(trialing.ok, true);
      assert.equal((await db.select().from(fulfillmentOrders)).length, 3);

      process.env.STRIPE_SECRET_KEY = SECRET;
      const calls: { url: string; body: string }[] = [];
      const fetchImpl: typeof fetch = async (input, init) => {
        const url = String(input);
        calls.push({ url, body: decodeURIComponent(String(init?.body ?? "")) });
        if (url.endsWith("/coupons")) {
          const duplicate = calls.filter((call) => call.url.endsWith("/coupons") && call.body.includes("percent_off=10")).length > 1;
          if (duplicate) {
            return new Response(JSON.stringify({ error: { code: "resource_already_exists", message: "Coupon already exists." } }), { status: 400 });
          }
          return new Response(JSON.stringify({ id: "coupon_ok" }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "cs_member", url: "https://checkout.stripe.com/member" }), { status: 200 });
      };

      const plus = await beginCreatorCheckout(db, {
        offerId: "starter_kit_basic",
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
      assert.match(calls[1]?.body ?? "", /line_items\[0\]\[price\]=price_1USge74Qt4QNnGtbk2AI0l8o/);
      assert.equal((calls[1]?.body ?? "").includes("metadata[plan]=plus"), false);
      assert.equal((await db.select().from(fulfillmentOrders)).length, 3);

      const plusAgain = await createCheckoutSession({
        offerId: "media_kit_bundle",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "plus",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(plusAgain.ok, true);
      assert.equal(calls.filter((call) => call.url.endsWith("/checkout/sessions")).length, 2);

      const pro = await beginCreatorCheckout(db, {
        offerId: "starter_kit_pro",
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
      const proSession = calls.filter((call) => call.url.endsWith("/checkout/sessions")).at(-1);
      assert.match(proSession?.body ?? "", new RegExp(`discounts\\[0\\]\\[coupon\\]=${memberCouponId("pro", 20)}`));

      const lapsed = await beginCreatorCheckout(db, {
        offerId: "media_kit_bundle",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "pro",
        memberStatus: "canceled",
      }, fetchImpl);
      assert.equal(lapsed.ok, true);
      assert.equal((calls.at(-1)?.body ?? "").includes("discounts["), false);
      assert.equal(calls.at(-1)?.url.endsWith("/checkout/sessions"), true);

      const guest = await beginCreatorCheckout(db, {
        offerId: "rate_card_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
      }, fetchImpl);
      assert.equal(guest.ok, true);
      assert.equal((calls.at(-1)?.body ?? "").includes("discounts["), false);

      const subscribe = await beginCreatorCheckout(db, {
        offerId: "business",
        interval: "month",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
        signed: true,
      }, fetchImpl);
      assert.equal(subscribe.ok, true);
      assert.match(calls.at(-1)?.body ?? "", /mode=subscription/);
      assert.equal((calls.at(-1)?.body ?? "").includes("discounts["), false);

      const directSigned = await createCheckoutSession({
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "plus",
        memberStatus: "active",
        signed: true,
      }, fetchImpl);
      assert.equal(directSigned.ok, false);
      assert.equal(directSigned.calledStripe, false);

      const directIncluded = await createCheckoutSession({
        offerId: "starter_kit_plus",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(directIncluded.ok, false);
      assert.equal(directIncluded.calledStripe, false);
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
    const config = source("src/lib/payments-config.ts");
    assert.match(config, /MEMBER_ONE_TIME_PERCENT_OFF/);
    assert.equal(config.includes("MEMBER_DISCOUNT_PERCENT"), false);
    assert.match(source("src/app/billing/page.tsx"), /oneTimeMemberNote\(\)/);
    assert.match(source("src/app/billing/page.tsx"), /memberServiceIncluded/);
    assert.match(source("src/app/billing-actions.ts"), /memberPlan: billing\.subscriptionPlan/);
    assert.match(source("src/app/billing-actions.ts"), /signed: await creatorIsSigned/);
    assert.match(source("src/app/dashboard/page.tsx"), /Mark signed/);
    assert.match(source("src/app/dashboard/page.tsx"), /MEMBER_ONE_TIME_PERCENT_OFF/);
    const example = source(".env.example");
    assert.equal(example.includes("MEMBER_DISCOUNT_PERCENT"), false);
    assert.match(example, /Plus 10, Pro 20, Business included/);
    assert.equal(process.env.PAYMENTS_ENABLED === "true", false);
    const still = await db.select().from(creators).where(eq(creators.id, "mariclare"));
    assert.equal(still[0]?.contracted, false);
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
