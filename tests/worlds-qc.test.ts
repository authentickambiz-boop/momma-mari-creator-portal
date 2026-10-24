import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { EARNINGS_CAP_CENTS, REAL_PAYMENTS } from "../src/lib/worlds/economy";
import { CITY_LOCATION_IDS } from "../src/lib/worlds/city/locations";
import {
  assertionOrder,
  formatQcTable,
  renderBuildingJson,
  renderBuildingMarkdown,
  renderQcSummary,
  runWorldsQc,
  spliceQcSummary,
} from "../src/lib/worlds/city/qc";
import { LIVE_EMAIL_SEND, LIVE_SOCIAL_ACTIONS, CITY_TASKS } from "../src/lib/worlds/city/tasks";

test("worlds QC passes every building task and the negative checks", () => {
  assert.equal(LIVE_SOCIAL_ACTIONS, false);
  assert.equal(LIVE_EMAIL_SEND, false);
  assert.equal(EARNINGS_CAP_CENTS, null);
  assert.equal(REAL_PAYMENTS, false);
  const qc = readFileSync("src/lib/worlds/city/qc.ts", "utf8");
  const script = readFileSync("scripts/worlds-qc.ts", "utf8");
  assert.equal(qc.includes("fetch("), false);
  assert.equal(script.includes("fetch("), false);
  assert.equal(qc.includes("mailto:"), false);

  const report = runWorldsQc();
  assert.equal(report.liveSocialActions, false);
  assert.equal(report.liveEmailSend, false);
  assert.equal(report.pass, true, formatQcTable(report));
  assert.deepEqual(report.buildings.map((item) => item.locationId), [...CITY_LOCATION_IDS]);

  const seen = new Set<string>();
  for (const building of report.buildings) {
    assert.equal(building.pass, true, building.locationId);
    assert.equal(building.sent, false);
    assert.equal(building.liveSocialActions, false);
    assert.equal(building.liveEmailSend, false);
    for (const task of building.tasks) {
      seen.add(task.taskId);
      assert.equal(task.pass, true, task.taskId);
      assert.equal(task.sent, false);
      assert.deepEqual(task.assertions.map((item) => item.name), [...assertionOrder()]);
      assert.equal(task.balanceCents, task.payoutCents);
      const catalog = CITY_TASKS.find((item) => item.id === task.taskId);
      assert.equal(catalog?.payoutCents, task.payoutCents);
      if (catalog && catalog.external !== "none") {
        assert.equal(catalog.pipeline.ownerGate, true);
        assert.equal(task.assertions.find((item) => item.name === "ownerGate")?.pass, true);
      }
      if (catalog?.pipeline.peerScore) assert.equal(typeof task.score, "number");
      else assert.equal(task.score, null);
    }
    const json = readFileSync(`src/lib/worlds/city/qc-reports/${building.locationId}.json`, "utf8");
    const markdown = readFileSync(`src/lib/worlds/city/qc-reports/${building.locationId}.md`, "utf8");
    assert.equal(json, renderBuildingJson(building));
    assert.equal(markdown, renderBuildingMarkdown(building));
  }
  const summaryJson = readFileSync("src/lib/worlds/city/qc-reports/summary.json", "utf8");
  assert.equal(summaryJson, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(seen.size, CITY_TASKS.length);

  assert.deepEqual(report.negatives.map((item) => item.id), [
    "spam-comment",
    "disallowed-note",
    "apartment-yard",
    "non-owner-office",
    "office-bot-leave",
  ]);
  for (const item of report.negatives) assert.equal(item.pass, true, item.detail);
  const disallowed = report.negatives.find((item) => item.id === "disallowed-note");
  assert.equal(disallowed?.name, "Disallowed note rejected");
  assert.match(disallowed?.detail ?? "", /not stored/);
  assert.equal(/\bnsfw\b/i.test(JSON.stringify(report)), false);

  const summary = renderQcSummary(report);
  for (const path of ["README.md", "src/lib/worlds/city/README.md"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes(summary.trim()), path);
    assert.match(source, /LIVE_SOCIAL_ACTIONS/);
    assert.match(source, /LIVE_EMAIL_SEND/);
    assert.equal(/\bnsfw\b/i.test(source), false, path);
  }
  for (const file of readdirSync("src/lib/worlds/city/qc-reports")) {
    const source = readFileSync(`src/lib/worlds/city/qc-reports/${file}`, "utf8");
    assert.equal(/\bnsfw\b/i.test(source), false, file);
  }
  assert.match(formatQcTable(report), /\nPASS$/);
});

test("QC summary splicing replaces only the marked block", () => {
  const source = `before\n<!-- worlds-qc:start -->\nold\n<!-- worlds-qc:end -->\nafter\n`;
  const next = spliceQcSummary(source, "fresh table");
  assert.equal(next, "before\n<!-- worlds-qc:start -->\nfresh table\n<!-- worlds-qc:end -->\nafter\n");
  assert.equal(spliceQcSummary("no markers", "fresh"), "no markers");
});
