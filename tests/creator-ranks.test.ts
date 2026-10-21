import assert from "node:assert/strict";
import { test } from "node:test";
import { benchPromotionSuggested } from "../src/lib/bench";
import {
  compositeScore,
  defaultWeights,
  leaderboard,
  pointsToNextRank,
  scoringInputs,
  tierFor,
} from "../src/lib/creator-rank";
import { admin, openTestDb } from "./harness";

test("scores from 0 to 100 map onto ten ranks, and Diamond has no next rank", () => {
  const bands = [
    [0, "Seedling"],
    [9, "Seedling"],
    [10, "Sprout"],
    [19, "Sprout"],
    [20, "Bronze"],
    [29, "Bronze"],
    [30, "Silver"],
    [39, "Silver"],
    [40, "Gold"],
    [49, "Gold"],
    [50, "Platinum"],
    [59, "Platinum"],
    [60, "Emerald"],
    [69, "Emerald"],
    [70, "Ruby"],
    [79, "Ruby"],
    [80, "Sapphire"],
    [89, "Sapphire"],
    [90, "Diamond"],
    [100, "Diamond"],
  ] as const;
  for (const [score, label] of bands) assert.equal(tierFor(score), label);
  assert.equal(pointsToNextRank(9).points, 1);
  assert.equal(pointsToNextRank(9).next, "Sprout");
  assert.equal(pointsToNextRank(42).points, 8);
  assert.equal(pointsToNextRank(42).next, "Platinum");
  assert.equal(pointsToNextRank(90).points, 0);
  assert.equal(pointsToNextRank(90).next, null);
  assert.equal(pointsToNextRank(100).points, 0);
  assert.equal(benchPromotionSuggested(40), false);
  assert.equal(benchPromotionSuggested(69), false);
  assert.equal(benchPromotionSuggested(70), true);
  assert.equal(benchPromotionSuggested(82), true);
});

test("July snapshots put Abby, AuthenticKam, and MariClare on the calibrated ranks", async () => {
  const db = openTestDb();
  const weights = defaultWeights();
  const scored = [];
  for (const id of ["abby", "authentickam", "mariclare"] as const) {
    const inputs = await scoringInputs(db, id);
    scored.push({ id, ...compositeScore(inputs, weights) });
  }
  const [abby, kam, mari] = scored;
  assert.ok(abby.score >= 5 && abby.score <= 19, `Abby scored ${abby.score}`);
  assert.ok(tierFor(abby.score) === "Seedling" || tierFor(abby.score) === "Sprout");
  assert.ok(kam.score >= 15 && kam.score <= 29, `AuthenticKam scored ${kam.score}`);
  assert.ok(tierFor(kam.score) === "Sprout" || tierFor(kam.score) === "Bronze");
  assert.ok(mari.score >= 40 && mari.score <= 49, `MariClare scored ${mari.score}`);
  assert.equal(tierFor(mari.score), "Gold");
  assert.ok(mari.score > kam.score && kam.score > abby.score);

  const board = await leaderboard(db, admin);
  assert.equal(board.ok, true);
  if (!board.ok) return;
  assert.deepEqual(board.rows.map((row) => row.rank), board.rows.map((_, index) => index + 1));
  const place = new Map(board.rows.map((row) => [row.creatorId, row]));
  assert.equal(place.get("abby")?.score, abby.score);
  assert.equal(place.get("authentickam")?.score, kam.score);
  assert.equal(place.get("mariclare")?.score, mari.score);
  assert.ok((place.get("mariclare")?.rank ?? 0) < (place.get("authentickam")?.rank ?? 0));
  assert.ok((place.get("authentickam")?.rank ?? 0) < (place.get("abby")?.rank ?? 0));
  assert.equal(place.get("mariclare")?.pointsToNext, pointsToNextRank(mari.score).points);
  assert.equal(place.get("abby")?.nextRank, pointsToNextRank(abby.score).next);
});
