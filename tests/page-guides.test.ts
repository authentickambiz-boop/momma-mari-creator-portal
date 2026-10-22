import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  PAGE_GUIDES,
  pageGuideFor,
  pageGuideIssues,
  pageGuideStartsOpen,
  pageGuideStorageKey,
} from "../src/lib/page-guides";
import { PORTAL_TABS, visiblePortalTabs } from "../src/lib/portal-tabs";
import { admin, mariclare } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const OWNER_ONLY = ["review", "prospects", "dashboard", "pipeline", "ranking", "reports", "bench", "invoices", "team"] as const;
const WITH_MANAGERS = ["brands", "rules", "campaigns", "access", "safety"] as const;

describe("page guides", () => {
  test("every menu page has one editable guide", () => {
    assert.deepEqual(pageGuideIssues(), []);
    assert.equal(Object.keys(PAGE_GUIDES).length, PORTAL_TABS.length);
    for (const tab of PORTAL_TABS) {
      const guide = pageGuideFor(tab.id);
      assert.equal(guide.id, tab.id);
      assert.equal(guide.steps.length >= 3 && guide.steps.length <= 5, true);
      assert.match(guide.purpose, /\S/);
      assert.match(guide.principle, /\S/);
    }
    for (const id of OWNER_ONLY) assert.match(PAGE_GUIDES[id].who, /^Owner only\./);
    for (const id of WITH_MANAGERS) assert.match(PAGE_GUIDES[id].who, /manager/i);
    assert.match(PAGE_GUIDES.approvals.who, /owner/i);
    assert.match(PAGE_GUIDES.approvals.who, /manager/i);
    assert.match(PAGE_GUIDES.pipeline.who, /Creators never see these cards/);
    assert.match(PAGE_GUIDES.pipeline.steps.join(" "), /Move to next stage/);
    assert.match(PAGE_GUIDES.deals.who, /own deals/);
    assert.equal(PAGE_GUIDES.learn.who.startsWith("Owner only"), false);
    assert.equal(pageGuideStorageKey("pipeline"), "mm-page-guide:pipeline");
    assert.equal(pageGuideStartsOpen(null), true);
    assert.equal(pageGuideStartsOpen(undefined), true);
    assert.equal(pageGuideStartsOpen("open"), true);
    assert.equal(pageGuideStartsOpen("collapsed"), false);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.id === "pipeline"), false);
    assert.equal(visiblePortalTabs(admin).some((tab) => tab.id === "pipeline"), true);

    const frame = source("src/components/portal-frame.tsx");
    assert.match(frame, /<PageGuide guide=\{pageGuideFor\(tab\)\} \/>/);
    assert.match(frame, /data-tab=\{tab\}/);
    const guide = source("src/components/page-guide.tsx");
    assert.match(guide, /How to use this page/);
    assert.match(guide, /pageGuideStorageKey/);
    assert.match(guide, /"collapsed"/);
    assert.match(guide, /What it&apos;s for/);
    assert.match(guide, /The idea/);
    const guides = source("src/lib/page-guides.ts");
    assert.equal(guides.includes("api.stripe.com"), false);
    assert.equal(guides.includes("messages.send"), false);
    const css = source("src/app/globals.css");
    assert.match(css, /body\[data-community="open"\] \.portal-app \{ padding-right: 370px; \}/);
    assert.match(css, /\.page-guide-who/);
  });
});
