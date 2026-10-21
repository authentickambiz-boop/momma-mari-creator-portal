import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { BRAND_PACKAGES, packageForBudget, packagePublicView, parseBudgetDollars } from "../src/lib/brand-packages";
import { packageCheckoutEnabled } from "../src/lib/package-checkout-flag";
import { packagePricesApproved } from "../src/lib/package-prices-flag";
import { paymentsEnabled } from "../src/lib/payments-config";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("brand packages", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("packages are booked by budget, prices stay hidden until approved, and checkout stays off", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    assert.equal(packageForBudget(50_000)?.id, "test");
    assert.equal(packageForBudget(99_999)?.id, "test");
    assert.equal(packageForBudget(100_000)?.id, "campaign");
    assert.equal(packageForBudget(500_000)?.id, "campaign");
    assert.equal(packageForBudget(500_001)?.id, "ambassador");
    assert.equal(packageForBudget(0), null);
    assert.deepEqual(parseBudgetDollars("$1,500"), { cents: 150000 });
    assert.equal(packageForBudget(150000)?.id, "campaign");
    assert.equal("error" in parseBudgetDollars("abc"), true);

    assert.equal(BRAND_PACKAGES.length, 3);
    assert.equal(paymentsEnabled(), false);
    assert.equal(packageCheckoutEnabled(), false);
    const previousPayments = process.env.PAYMENTS_ENABLED;
    const previousPackage = process.env.BRAND_PACKAGE_CHECKOUT_ENABLED;
    process.env.PAYMENTS_ENABLED = "true";
    try {
      assert.equal(packageCheckoutEnabled(), false);
      process.env.BRAND_PACKAGE_CHECKOUT_ENABLED = "true";
      assert.equal(packageCheckoutEnabled(), true);
    } finally {
      if (previousPayments == null) delete process.env.PAYMENTS_ENABLED;
      else process.env.PAYMENTS_ENABLED = previousPayments;
      if (previousPackage == null) delete process.env.BRAND_PACKAGE_CHECKOUT_ENABLED;
      else process.env.BRAND_PACKAGE_CHECKOUT_ENABLED = previousPackage;
    }
    assert.equal(packageCheckoutEnabled(), false);
    assert.equal(paymentsEnabled(), false);

    const packages = source("src/lib/brand-packages.ts");
    const page = source("src/app/packages/page.tsx");
    const action = source("src/app/package-actions.ts");
    assert.equal(packages.includes("TODO: owner approval"), false);
    assert.equal(packages.toLowerCase().includes("minimum"), false);
    assert.equal(packages.includes("deal-rules"), false);
    assert.match(page, /disabled=\{!checkoutOn\}/);
    assert.match(packages, /Request a quote/);
    assert.match(page, /packagePublicView/);
    assert.match(page, /quoteHref/);
    assert.match(page, /quoteLabel/);
    assert.equal(page.includes("Placeholder price"), false);
    assert.equal(page.includes("TODO: owner approval"), false);
    assert.equal(page.includes("$750"), false);
    assert.equal(page.includes("api.stripe.com"), false);
    assert.equal(action.includes("stripe"), false);
    assert.match(action, /Nothing was charged|never starts a Stripe session/);
    assert.equal(isPublicMarketingPath("/packages", ""), true);
    assert.match(source("src/components/public-shell.tsx"), /href="\/packages"/);

    const previousApproved = process.env.PACKAGE_PRICES_APPROVED;
    delete process.env.PACKAGE_PRICES_APPROVED;
    try {
      assert.equal(packagePricesApproved(), false);
      const hidden = packagePublicView(false);
      assert.equal(hidden.robots.index, false);
      assert.equal(hidden.cards.every((card) => card.priceLabel == null && card.quoteHref === "/inquire" && card.quoteLabel === "Request a quote"), true);
      assert.equal(JSON.stringify(hidden.cards.map((card) => card.priceLabel)).includes("$"), false);
      assert.equal(JSON.stringify(hidden).toLowerCase().includes("placeholder"), false);
      assert.equal(JSON.stringify(hidden).toLowerCase().includes("todo"), false);
      assert.equal(JSON.stringify(hidden).toLowerCase().includes("minimum"), false);
      process.env.PACKAGE_PRICES_APPROVED = "true";
      assert.equal(packagePricesApproved(), true);
      const shown = packagePublicView(true);
      assert.equal(shown.robots.index, true);
      assert.deepEqual(shown.cards.map((card) => card.priceLabel), ["$750", "$2,500", "$7,500"]);
      assert.equal(shown.cards.every((card) => card.quoteHref == null), true);
      process.env.PACKAGE_PRICES_APPROVED = "TRUE";
      assert.equal(packagePricesApproved(), false);
    } finally {
      if (previousApproved == null) delete process.env.PACKAGE_PRICES_APPROVED;
      else process.env.PACKAGE_PRICES_APPROVED = previousApproved;
    }
    assert.equal(packagePricesApproved(), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
