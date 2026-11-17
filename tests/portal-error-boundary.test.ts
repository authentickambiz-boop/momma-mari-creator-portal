import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { deals } from "../src/db/schema";
import { guardPortal, portalErrorRef, redactPortalLog } from "../src/lib/portal-error";
import { getDealForViewer, listDealsForViewer } from "../src/lib/queries";
import { normalizeQuestionnaireAnswers } from "../src/lib/questionnaire";
import { mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("portal error boundary", () => {
  test("try again re-fetches, then reloads if the page is still stopped", () => {
    const page = source("src/app/error.tsx");
    assert.match(page, /retry\(\)/);
    assert.match(page, /window\.location\.reload\(\)/);
    assert.match(page, /Nothing was emailed or charged/);
    assert.match(page, /Reference/);
    assert.match(page, /method="get"/);
    assert.match(source("src/instrumentation.ts"), /onRequestError/);
    assert.match(source("src/app/page.tsx"), /guardPortal\("deals"/);
    assert.match(source("src/app/api/deals/live/route.ts"), /logPortalError\("live deals"/);
  });

  test("a reference id is short and logs do not keep tokens", () => {
    assert.equal(portalErrorRef("AbCdef123456"), "abcdef12");
    assert.equal(portalErrorRef("").length, 8);
    const cleaned = redactPortalLog("Bearer ya29.secret v1:abcdefghijklmnop012345");
    assert.equal(cleaned.includes("ya29"), false);
    assert.equal(cleaned.includes("abcdefghijklmnop"), false);
    assert.match(cleaned, /Bearer \[redacted\]/);
  });

  test("one failed data source does not reject the page", async () => {
    const value = await guardPortal("analytics", null, async () => {
      throw new Error("no such table: analytics_snapshots");
    });
    assert.equal(value, null);
  });

  test("a bad chips or deliverables blob does not throw for MariClare", async () => {
    const db = openTestDb();
    await db.update(deals).set({
      chipsJson: "{\"not\":\"a list\"}",
      deliverablesJson: "\"one tiktok\"",
    }).where(eq(deals.id, "kosbling"));
    const rows = await listDealsForViewer(db, mariclare, "mariclare");
    const kosbling = rows.find((deal) => deal.id === "kosbling");
    assert.ok(kosbling);
    assert.deepEqual(kosbling.chips, []);
    const detail = await getDealForViewer(db, mariclare, "kosbling");
    assert.deepEqual(detail?.deliverables, ["one tiktok"]);
    const answers = normalizeQuestionnaireAnswers({ niches: "beauty", platforms: ["tiktok"], handles: { tiktok: "@mari" }, kidsConfirm: true });
    assert.deepEqual(answers.niches, []);
    assert.deepEqual(answers.platforms, ["tiktok"]);
    assert.equal(answers.handles.tiktok, "@mari");
    assert.equal(answers.kidsConfirm, true);
  });
});
