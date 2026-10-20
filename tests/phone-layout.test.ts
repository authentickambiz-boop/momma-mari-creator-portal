import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("phone layout", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("phone forms stack their labels, deal names can shrink, and the tab row does not stick under the header", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    assert.match(css, /\.deal \.name \{ font-weight: 700; min-width: 0; flex: 1; overflow-wrap: anywhere; \}/);
    assert.match(css, /form\.stack > label:not\(:has\(input\[type="checkbox"\]\)\):not\(:has\(input\[type="radio"\]\)\)/);
    assert.match(css, /\.card\.stack > label:has\(input\[type="checkbox"\]\)/);
    assert.match(css, /\.public-form \.btn \{ width: 100%; \}/);
    assert.match(css, /\.public-grid \.card h2 \{[^}]*overflow-wrap: anywhere;/);
    const phone = css.slice(css.indexOf("@media (max-width: 820px)"));
    const tabs = phone.slice(phone.indexOf("nav.tabs {"), phone.indexOf("nav.tabs a"));
    assert.match(tabs, /position: static;/);
    assert.equal(tabs.includes("position: sticky"), false);
    assert.equal(tabs.includes("top: 100px"), false);

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
