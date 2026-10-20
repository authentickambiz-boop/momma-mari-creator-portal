import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("public page chrome", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("marketing pages skip chat and the home screen bar", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    assert.equal(isPublicMarketingPath("/services", ""), true);
    assert.equal(isPublicMarketingPath("/roster/", ""), true);
    assert.equal(isPublicMarketingPath("/inquire?sent=1", ""), true);
    assert.equal(isPublicMarketingPath("/portal/services", "/portal"), true);
    assert.equal(isPublicMarketingPath("/portal/roster/", "/portal"), true);
    assert.equal(isPublicMarketingPath("/login", ""), false);
    assert.equal(isPublicMarketingPath("/portal/login", "/portal"), false);
    assert.equal(isPublicMarketingPath("/services/extra", ""), false);

    const chat = readFileSync(path.join(process.cwd(), "src/components/community-panel.tsx"), "utf8");
    const home = readFileSync(path.join(process.cwd(), "src/components/home-screen.tsx"), "utf8");
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    assert.match(chat, /isPublicMarketingPath/);
    assert.match(chat, /if \(hidden \|\| publicPage\) return null/);
    assert.match(home, /if \(publicPage\) return null/);
    assert.match(css, /\.wrap:has\(\.public-head\) > h1/);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingBefore?.stageEvents?.length);
  });
});
