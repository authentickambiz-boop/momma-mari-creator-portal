import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { BRAND_PACKAGES, packageForBudget, parseBudgetDollars } from "../src/lib/brand-packages";
import { packageCheckoutEnabled } from "../src/lib/package-checkout-flag";
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

  test("packages are booked by budget, with placeholder prices and checkout left off", async () => {
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
    assert.match(packages, /TODO: owner approval/);
    assert.equal(packages.toLowerCase().includes("minimum"), false);
    assert.equal(packages.includes("deal-rules"), false);
    assert.match(page, /disabled=\{!checkoutOn\}/);
    assert.match(page, /Placeholder price/);
    assert.equal(page.includes("api.stripe.com"), false);
    assert.equal(action.includes("stripe"), false);
    assert.match(action, /Nothing was charged|never starts a Stripe session/);
    assert.equal(isPublicMarketingPath("/packages", ""), true);
    assert.match(source("src/components/public-shell.tsx"), /href="\/packages"/);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
