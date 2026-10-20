import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("page checkbox wrap", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("long checkbox labels and cards stay inside the page on a phone", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const checkbox = css.slice(css.indexOf("label.contract-choices {"), css.indexOf(".private-note"));
    assert.match(checkbox, /grid-template-columns: auto minmax\(0, 1fr\);/);
    assert.match(checkbox, /min-width: 0;/);
    const card = css.slice(css.indexOf(".card {"), css.indexOf("a.deal, button.deal {"));
    assert.match(card, /overflow-wrap: break-word;/);
    const phone = css.slice(css.indexOf("@media (max-width: 820px)"));
    assert.match(phone, /label\.contract-choices \{ flex: 1 1 100%; \}/);
    assert.match(phone, /\.connect-actions \{ width: 100%; justify-content: flex-start; \}/);
    assert.match(phone, /\.connect-actions \.chip \{ flex: 1 0 100%; \}/);
    assert.match(phone, /\.connect-actions form,\s*\.connect-actions > \.btn \{ flex: 1 1 8rem; \}/);
    assert.match(phone, /\.connect-actions \.btn \{ flex: 1 1 8rem; text-align: center; width: 100%; \}/);
    const gifts = readFileSync(path.join(process.cwd(), "src/app/gifts/page.tsx"), "utf8");
    const access = readFileSync(path.join(process.cwd(), "src/app/access/page.tsx"), "utf8");
    const connect = readFileSync(path.join(process.cwd(), "src/components/connect-panel.tsx"), "utf8");
    assert.match(gifts, /className="contract-choices"/);
    assert.match(access, /className="contract-choices"/);
    assert.match(connect, /className="connect-actions"/);

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
