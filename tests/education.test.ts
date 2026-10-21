import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { EDUCATION_TEMPLATES, LESSONS, educationTemplate } from "../src/lib/education";
import { paymentsEnabled } from "../src/lib/payments-config";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("creator education", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("lessons skip private floors and the templates say to have a lawyer review", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    assert.deepEqual(LESSONS.map((lesson) => lesson.id), ["deals", "rates", "usage", "ftc"]);
    const lessonText = LESSONS.map((lesson) => lesson.body.join(" ")).join(" ");
    assert.match(lessonText, /20 percent/);
    assert.match(lessonText, /disclosure/i);
    assert.match(lessonText, /whitelisting/i);
    assert.equal(lessonText.includes("$"), false);
    assert.equal(lessonText.toLowerCase().includes("minimum"), false);
    assert.deepEqual(EDUCATION_TEMPLATES.map((item) => item.slug), ["brand-agreement", "gifted-agreement", "usage-addendum"]);
    for (const item of EDUCATION_TEMPLATES) {
      assert.match(item.body, /template, have a lawyer review/);
      assert.equal(item.body.includes("$"), false);
      assert.equal(educationTemplate(item.slug)?.filename, item.filename);
    }
    assert.equal(educationTemplate("missing"), null);
    const page = source("src/app/learn/page.tsx");
    const route = source("src/app/learn/templates/[slug]/route.ts");
    assert.match(page, /template, have a lawyer review/);
    assert.equal(page.toLowerCase().includes("docusign"), false);
    assert.equal(route.includes("currentViewer"), true);
    assert.equal(route.toLowerCase().includes("docusign"), false);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.href === "/learn"), true);
    assert.equal(visiblePortalTabs(admin).some((tab) => tab.href === "/learn"), true);
    assert.equal(paymentsEnabled(), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
