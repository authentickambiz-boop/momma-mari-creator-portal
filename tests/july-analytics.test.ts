import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { analyticsSnapshots } from "../src/db/schema";
import {
  JULY_HEADLINE_HIDDEN,
  analyticsBoard,
  importAnalyticsSnapshots,
  julyHeadline,
} from "../src/lib/analytics-snapshots";
import { scoringInputs } from "../src/lib/creator-rank";
import { listDailyMetrics, listPostMetrics, summarizeAnalytics } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("July analytics replace example cards", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("the creator headline uses July's latest labels and leaves out figures July did not show", async () => {
    const board = await analyticsBoard(db, mariclare);
    const mari = board.creators[0];
    const headline = julyHeadline(mari);
    assert.deepEqual(headline.cards.map((card) => card.value), ["2.3m", "6.76%", "245k"]);
    assert.deepEqual(headline.cards.map((card) => card.label), [
      "TikTok followers · @_mariclaremaclamroc_",
      "Engagement rate · TikTok",
      "Average views per video · TikTok",
    ]);
    assert.deepEqual(headline.hidden, [...JULY_HEADLINE_HIDDEN]);
    const packed = JSON.stringify(headline.cards);
    assert.equal(packed.includes("last 7 days"), false);
    assert.equal(packed.includes("last 14 days"), false);
    assert.equal(packed.includes("last 30 days"), false);
    assert.equal(packed.includes("1,240,000"), false);
    assert.equal(packed.includes("Example"), false);
    assert.equal(packed.toLowerCase().includes("minimum"), false);

    const owner = await analyticsBoard(db, admin);
    const abby = julyHeadline(owner.creators.find((creator) => creator.creatorId === "abby")!);
    const kam = julyHeadline(owner.creators.find((creator) => creator.creatorId === "authentickam")!);
    assert.deepEqual(abby.cards.map((card) => card.value), ["78.8k", "6.39%", "6,237"]);
    assert.deepEqual(kam.cards.map((card) => card.value), ["178k", "6.46%", "58.6k"]);
    assert.equal(JSON.stringify(owner).includes("Example post"), false);
    assert.equal(JSON.stringify(owner).includes("1240000"), false);
    assert.equal(JSON.stringify(board).includes("178k"), false);

    const summary = summarizeAnalytics(await listDailyMetrics(db, "mariclare"), await listPostMetrics(db, "mariclare"));
    assert.equal(summary.daily.length, 0);
    assert.equal(summary.posts.length, 0);
    assert.equal(summary.newFollowers, null);

    const panel = source("src/components/analytics-panel.tsx");
    const page = source("src/app/analytics/page.tsx");
    assert.equal(panel.includes("EXAMPLE"), false);
    assert.equal(panel.includes("made up"), false);
    assert.equal(panel.includes("Example post"), false);
    assert.equal(page.includes("EXAMPLE"), false);
    assert.match(page, /julyHeadline/);
  });

  test("the Oct 18 snapshot stays behind the Oct 19 figures and does not invent a saves count", async () => {
    const earlier = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-mariclare-instagram-2026-10-18-past30d");
    assert.match(earlier?.metricsJson ?? "", /1\.1M/);
    assert.equal((earlier?.metricsJson ?? "").includes("likes"), false);
    const abby = (await db.select().from(analyticsSnapshots)).find((row) => row.id === "snap-abby-instagram-2026-10-18-past30d");
    assert.match(abby?.metricsJson ?? "", /"saves":null/);
    assert.equal((abby?.metricsJson ?? "").includes("-1"), false);

    const board = await analyticsBoard(db, mariclare);
    const instagram = board.creators[0].platforms.find((row) => row.platform === "Instagram");
    assert.equal(board.creators[0].totalAudience, "2,643,404");
    assert.equal(instagram?.metrics.followers, "326k");
    assert.equal(instagram?.metrics.reach, "1.2m");
    assert.equal(instagram?.change?.previousOn, "2026-10-18");
    assert.equal(instagram?.trend[0].followers, "326K");

    const scored = await scoringInputs(db, "mariclare");
    assert.equal(scored.followers, 2643404);

    const file = JSON.parse(readFileSync(path.join(process.cwd(), "data/analytics-snapshots-2026-10-18.json"), "utf8"));
    const brought = await importAnalyticsSnapshots(db, file);
    assert.equal(brought.ok, true);
    if (brought.ok) assert.equal(brought.saved, 11);
    const still = (await db.select().from(analyticsSnapshots).where(eq(analyticsSnapshots.id, "snap-mariclare-instagram-2026-10-19-past30d")))[0];
    assert.match(still?.metricsJson ?? "", /1\.2m/);
    assert.equal((still?.metricsJson ?? "").includes("1.1M"), false);
  });
});
