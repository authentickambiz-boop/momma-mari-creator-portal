import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { boldSignEnabled } from "../src/lib/boldsign";
import { AGENCY_COMMISSION_PERCENT, formatMoney } from "../src/lib/format";
import { gmailSyncEnabled } from "../src/lib/gmail-sync-flag";
import { pushEnabled } from "../src/lib/home-screen";
import { packageCheckoutEnabled } from "../src/lib/package-checkout-flag";
import { packagePricesApproved } from "../src/lib/package-prices-flag";
import {
  MEMBER_ONE_TIME_PERCENT_OFF,
  PAYMENT_OFFERS,
  memberPriceCents,
  memberServiceIncluded,
  paymentsEnabled,
} from "../src/lib/payments-config";
import { PRICE_NOT_SET, pricingPageModel } from "../src/lib/pricing-page";
import { robotsAllowPaths, sitemapPublicPaths } from "../src/lib/public-meta";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function withEnv(name: string, value: string | null, run: () => void) {
  const previous = process.env[name];
  if (value == null) delete process.env[name];
  else process.env[name] = value;
  try {
    run();
  } finally {
    if (previous == null) delete process.env[name];
    else process.env[name] = previous;
  }
}

describe("plans and services page", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("the public page is a waitlist until payments are on, and the preview keeps catalog prices", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");

    assert.equal(sitemapPublicPaths().includes("/pricing"), true);
    assert.equal(robotsAllowPaths().includes("/pricing"), true);
    withEnv("PACKAGE_PRICES_APPROVED", null, () => {
      assert.equal(packagePricesApproved(), false);
      assert.equal(sitemapPublicPaths().includes("/packages"), false);
      assert.equal(robotsAllowPaths().includes("/packages"), true);
    });

    assert.equal(paymentsEnabled(), false);
    assert.equal(packageCheckoutEnabled(), false);
    assert.equal(gmailSyncEnabled(), false);
    assert.equal(pushEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    const example = source(".env.example");
    for (const key of ["PAYMENTS_ENABLED=", "GMAIL_SYNC_ENABLED=", "PUSH_ENABLED=", "BOLDSIGN_ENABLED=", "PACKAGE_PRICES_APPROVED=", "ANALYTICS_ENABLED="]) {
      assert.match(example, new RegExp(`^${key}$`, "m"));
    }

    const model = pricingPageModel(false);
    for (const id of ["plus", "pro", "business"] as const) {
      const offer = PAYMENT_OFFERS.find((item) => item.id === id);
      const plan = model.plans.find((item) => item.id === id);
      assert.equal(plan?.name, offer?.name);
      for (const interval of ["month", "year"] as const) {
        const price = offer?.prices.find((item) => item.interval === interval);
        const shown = plan?.prices.find((item) => item.interval === interval);
        assert.equal(shown?.text, price?.label);
        assert.equal(shown?.placeholder, false);
      }
    }
    assert.deepEqual(model.plans.map((plan) => plan.prices.find((price) => price.interval === "month")?.text), ["$19/mo", "$39/mo", "$199/mo"]);
    assert.equal(JSON.stringify(model).includes(PRICE_NOT_SET), false);

    const services = model.groups.flatMap((group) => group.services);
    for (const id of ["media_kit_build", "rate_card_build", "contract_review", "starter_kit_basic", "starter_kit_pro", "starter_kit_plus", "media_kit_bundle"]) {
      const offer = PAYMENT_OFFERS.find((item) => item.id === id);
      const service = services.find((item) => item.id === id);
      const price = offer?.prices[0];
      assert.equal(service?.name, offer?.name);
      assert.equal(service?.price, price?.label);
      assert.equal(service?.placeholder, false);
      assert.equal(service?.plus, `Plus ${MEMBER_ONE_TIME_PERCENT_OFF.plus}% off · ${formatMoney(memberPriceCents(price?.amountCents ?? 0, MEMBER_ONE_TIME_PERCENT_OFF.plus))}`);
      assert.equal(service?.pro, `Pro ${MEMBER_ONE_TIME_PERCENT_OFF.pro}% off · ${formatMoney(memberPriceCents(price?.amountCents ?? 0, MEMBER_ONE_TIME_PERCENT_OFF.pro))}`);
      assert.equal(memberServiceIncluded(MEMBER_ONE_TIME_PERCENT_OFF.business), true);
      assert.equal(service?.business, "Business · Included");
    }
    assert.deepEqual(model.groups.map((group) => group.id), ["media_kits", "rate_cards", "contract_reviews", "starter_kits"]);
    assert.match(model.fee.selfServe, new RegExp(`Self-serve creators pay ${AGENCY_COMMISSION_PERCENT}% only on deals that come through Momma Mari`));
    assert.match(model.fee.signed, new RegExp(`Signed creators pay ${AGENCY_COMMISSION_PERCENT}% on all deals and get these services included`));
    assert.match(model.fee.members, /Plus members get 10% off/);
    assert.match(model.fee.members, /Pro members get 20% off/);
    assert.match(model.fee.members, /Business members get them included/);
    assert.match(model.fee.members, /Signed creators get them included/);

    const withoutPro = PAYMENT_OFFERS.filter((offer) => offer.id !== "pro");
    const preview = pricingPageModel(true, withoutPro);
    const hidden = pricingPageModel(false, withoutPro);
    const previewPro = preview.plans.find((plan) => plan.id === "pro");
    assert.equal(previewPro?.prices.every((price) => price.placeholder && price.text === PRICE_NOT_SET), true);
    assert.equal(hidden.plans.some((plan) => plan.id === "pro"), false);
    assert.equal(JSON.stringify(hidden).includes(PRICE_NOT_SET), false);

    const withoutYear = PAYMENT_OFFERS.map((offer) => offer.id === "business"
      ? { ...offer, prices: offer.prices.filter((price) => price.interval !== "year") }
      : offer);
    const previewYear = pricingPageModel(true, withoutYear).plans.find((plan) => plan.id === "business");
    const publicYear = pricingPageModel(false, withoutYear).plans.find((plan) => plan.id === "business");
    assert.equal(previewYear?.prices.find((price) => price.interval === "year")?.placeholder, true);
    assert.equal(publicYear?.prices.some((price) => price.interval === "year"), false);
    assert.equal(publicYear?.prices.find((price) => price.interval === "month")?.text, "$199/mo");

    const packed = JSON.stringify(pricingPageModel(true));
    assert.equal(packed.toLowerCase().includes("minimum"), false);
    assert.equal(packed.toLowerCase().includes("floor"), false);
    const page = source("src/app/pricing/page.tsx");
    const previewPage = source("src/app/pricing/preview/page.tsx");
    const catalog = source("src/components/pricing-catalog.tsx");
    const lib = source("src/lib/pricing-page.ts");
    assert.match(page, /paymentsEnabled\(\)/);
    assert.match(page, /PricingWaitlist/);
    const redirects = source("next.config.ts");
    assert.match(redirects, /source:\s*"\/plans"/);
    assert.match(redirects, /destination:\s*"\/pricing"/);
    assert.match(redirects, /permanent:\s*false/);
    assert.match(page, /preview=\{false\}/);
    assert.match(source("src/components/pricing-waitlist.tsx"), /Coming soon, join waitlist/);
    assert.equal(source("src/components/pricing-waitlist.tsx").includes("$"), false);
    assert.match(previewPage, /isOwner/);
    assert.match(previewPage, /notFound\(\)/);
    assert.match(previewPage, /index: false/);
    assert.match(previewPage, /<PricingCatalog preview/);
    assert.match(catalog, /pricingPageModel/);
    assert.match(catalog, /data-price-placeholder/);
    assert.match(catalog, /data-pricing-fees/);
    assert.match(lib, /AGENCY_COMMISSION_PERCENT/);
    assert.match(lib, /PAYMENT_OFFERS/);
    for (const file of [page, previewPage, catalog, lib]) {
      assert.equal(file.includes("api.stripe.com"), false);
      assert.equal(file.includes("startCheckoutAction"), false);
      assert.equal(file.toLowerCase().includes("minimum"), false);
    }
    assert.equal(isPublicMarketingPath("/pricing", ""), true);
    assert.equal(isPublicMarketingPath("/pricing/preview", ""), true);
    assert.equal(isPublicMarketingPath("/portal/pricing", "/portal"), true);
    assert.match(source("src/components/public-shell.tsx"), /<Link href="\/pricing">Plans<\/Link>/);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
