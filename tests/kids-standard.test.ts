import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { KIDS_STANDARD, KIDS_STANDARD_PATH } from "../src/lib/kids-standard";
import { paymentsEnabled } from "../src/lib/payments-config";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("kids in content", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("the public standard covers safety, privacy, hours, set-aside earnings, and consent", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    assert.deepEqual(KIDS_STANDARD.map((section) => section.title), [
      "Child safety",
      "Privacy",
      "Work hours",
      "Earnings set aside",
      "Consent",
    ]);
    const packed = JSON.stringify(KIDS_STANDARD);
    assert.match(packed, /No brand can require/);
    assert.match(packed, /school/i);
    assert.match(packed, /Illinois/);
    assert.match(packed, /final yes/);
    assert.equal(packed.includes("$"), false);
    assert.equal(packed.toLowerCase().includes("minimum"), false);
    assert.match(source("src/lib/kids-standard.ts"), /pending legal review/);
    assert.match(source("src/app/our-standard/page.tsx"), /KIDS_STANDARD/);
    assert.match(source("src/components/public-shell.tsx"), /Kids in content/);
    assert.match(source("src/components/public-shell.tsx"), /KIDS_STANDARD_PATH/);
    assert.equal(KIDS_STANDARD_PATH, "/our-standard");
    assert.equal(isPublicMarketingPath("/our-standard", ""), true);
    assert.equal(isPublicMarketingPath("/portal/our-standard", "/portal"), true);
    assert.equal(paymentsEnabled(), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
