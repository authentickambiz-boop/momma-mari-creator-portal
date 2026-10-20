import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("portal gap sweep", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("error pages, empty lists, and the phone tab row say what happened", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const errorPage = source("src/app/error.tsx");
    assert.match(errorPage, /Nothing was emailed or charged/);
    assert.match(errorPage, /Back to deals/);
    assert.match(errorPage, /href="\/"/);

    const missing = source("src/app/not-found.tsx");
    assert.match(missing, /Nothing was changed/);
    assert.match(missing, /Back to deals/);

    const earnings = source("src/components/earnings-panel.tsx");
    assert.match(earnings, /No deals on this list yet\. Nothing is paid from this page\./);

    const ranking = source("src/app/ranking/page.tsx");
    assert.match(ranking, /No ranks yet\. Nothing is emailed\./);
    assert.match(ranking, /Saved\. Nothing was emailed\./);

    const reports = source("src/app/reports/page.tsx");
    assert.match(reports, /No reports yet\. Nothing is emailed\./);

    const team = source("src/app/team/page.tsx");
    assert.match(team, /No managers yet\./);

    const brands = source("src/app/brands/page.tsx");
    assert.match(brands, /No brands on this list yet\./);
    assert.match(brands, /Saved\. Nothing was emailed\./);

    const tabs = source("src/components/tab-row.tsx");
    assert.match(tabs, /scrollIntoView\(\{ inline: "nearest", block: "nearest" \}\)/);
    assert.match(tabs, /querySelector\("a\.on"\)/);
    const frame = source("src/components/portal-frame.tsx");
    assert.match(frame, /<TabRow>/);

    const css = source("src/app/globals.css");
    const phone = css.slice(css.indexOf("@media (max-width: 820px)"));
    assert.match(phone, /position: static;/);
    assert.match(phone, /scroll-padding-inline: 16px;/);
    assert.match(phone, /flex-wrap: nowrap;/);
    assert.match(phone, /overflow-x: auto;/);

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
