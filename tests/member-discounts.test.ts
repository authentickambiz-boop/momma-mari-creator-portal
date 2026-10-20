import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creators, creatorPurchases, fulfillmentOrders } from "../src/db/schema";
import { beginCreatorCheckout, checkoutStatusNote, createCheckoutSession, oneTimePriceNote } from "../src/lib/payments";
import {
  memberCouponId,
  memberDiscountPercent,
  memberOneTimePercent,
  memberPriceCents,
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

  test("active plans share one percent, and only a signed creator skips Checkout", async () => {
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
      assert.equal(memberDiscountPercent(), 0);
      assert.equal(memberDiscountPercent("15"), 15);
      assert.equal(memberDiscountPercent("nope"), 0);
      assert.equal(memberDiscountPercent("101"), 0);
      assert.equal(memberOneTimePercent("plus", "active"), 0);
      assert.equal(memberOneTimePercent("business", "active"), 0);
      assert.equal(memberOneTimePercent("pro", "canceled"), 0);
      assert.match(oneTimeMemberNote(), /That percent is 0 until it is set/);
      assert.match(oneTimeMemberNote(), /Signed creators get them included/);
      assert.equal(oneTimeMemberNote().includes("Business members get them included"), false);
      assert.equal(oneTimePriceNote("$149", 14900, 0), "$149");
      assert.match(oneTimePriceNote("$149", 14900, 15), /You pay \$126\.65/);
      assert.match(oneTimePriceNote("$149", 14900, 15, true), /Included with your contract/);
      assert.equal(memberPriceCents(14900, 15), 12665);
      assert.equal(checkoutStatusNote("included"), "Included with your contract. It is in the fulfillment queue. Nothing was charged.");
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
      process.env.MEMBER_DISCOUNT_PERCENT = "15";
      const included = await beginCreatorCheckout(db, {
        offerId: "rate_card_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
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

      process.env.STRIPE_SECRET_KEY = SECRET;
      const calls: { url: string; body: string }[] = [];
      const fetchImpl: typeof fetch = async (input, init) => {
        const url = String(input);
        calls.push({ url, body: decodeURIComponent(String(init?.body ?? "")) });
        if (url.endsWith("/coupons")) {
          return new Response(JSON.stringify({ id: memberCouponId(15) }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "cs_member", url: "https://checkout.stripe.com/member" }), { status: 200 });
      };

      for (const plan of ["plus", "pro", "business"] as const) {
        const bought = await beginCreatorCheckout(db, {
          offerId: "media_kit_build",
          interval: "one_time",
          email: "mmaclamroc@gmail.com",
          creatorId: "mariclare",
          memberPlan: plan,
          memberStatus: "active",
        }, fetchImpl);
        assert.equal(bought.ok, true);
        assert.equal(bought.calledStripe, true);
      }
      assert.equal((await db.select().from(fulfillmentOrders)).length, 1);
      const coupons = calls.filter((call) => call.url.endsWith("/coupons"));
      assert.equal(coupons.length, 3);
      for (const coupon of coupons) {
        assert.match(coupon.body, /percent_off=15(?:&|$)/);
        assert.match(coupon.body, new RegExp(`id=${memberCouponId(15)}`));
      }
      for (const session of calls.filter((call) => call.url.endsWith("/checkout/sessions"))) {
        assert.match(session.body, /mode=payment/);
        assert.match(session.body, new RegExp(`discounts\\[0\\]\\[coupon\\]=${memberCouponId(15)}`));
      }

      delete process.env.MEMBER_DISCOUNT_PERCENT;
      const before = calls.length;
      const fullPrice = await beginCreatorCheckout(db, {
        offerId: "contract_review",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "plus",
        memberStatus: "active",
      }, fetchImpl);
      assert.equal(fullPrice.ok, true);
      assert.equal(calls.length, before + 1);
      assert.equal(calls.at(-1)?.url.endsWith("/checkout/sessions"), true);
      assert.equal((calls.at(-1)?.body ?? "").includes("discounts["), false);

      process.env.MEMBER_DISCOUNT_PERCENT = "15";
      const lapsed = await beginCreatorCheckout(db, {
        offerId: "starter_kit_basic",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "pro",
        memberStatus: "canceled",
      }, fetchImpl);
      assert.equal(lapsed.ok, true);
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

      const direct = await createCheckoutSession({
        offerId: "media_kit_build",
        interval: "one_time",
        email: "mmaclamroc@gmail.com",
        creatorId: "mariclare",
        memberPlan: "business",
        memberStatus: "active",
        signed: true,
      }, fetchImpl);
      assert.equal(direct.ok, false);
      assert.equal(direct.calledStripe, false);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
    }

    const offers = source("src/components/billing-offers.tsx");
    assert.match(offers, /Coming soon/);
    assert.equal(offers.includes("10%"), false);
    assert.equal(source("src/lib/payments-config.ts").includes("MEMBER_ONE_TIME_PERCENT_OFF"), false);
    assert.match(source("src/lib/payments-config.ts"), /MEMBER_DISCOUNT_PERCENT/);
    assert.match(source("src/app/billing-actions.ts"), /signed: await creatorIsSigned/);
    assert.match(source("src/app/dashboard/page.tsx"), /Mark signed/);
    assert.match(source(".env.example"), /MEMBER_DISCOUNT_PERCENT=/);
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
