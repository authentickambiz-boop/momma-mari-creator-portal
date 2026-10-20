import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { podMetrics, reinvestmentEntries } from "../src/db/schema";
import { addManager } from "../src/lib/managers";
import { recordPodMetric, savePod } from "../src/lib/pods";
import { addReinvestment } from "../src/lib/reinvestment";
import { buildMonthlyReport } from "../src/lib/report";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("month calendar", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a month has to be 01 through 12, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    for (const month of ["2026-13", "2026-00", "2026-1"]) {
      const report = await buildMonthlyReport(db, "abby", month);
      assert.equal(report.ok, false);
      if (!report.ok) assert.equal(report.error, "Month has to look like 2026-10.");

      const logged = await addReinvestment(db, admin, { month, category: "tools", amountCents: 100 });
      assert.equal(logged.ok, false);
      if (!logged.ok) assert.equal(logged.error, "Use a month like 2026-10.");
    }

    const manager = await addManager(db, { actorRole: "admin", name: "Month Manager", email: "month.manager@example.com" });
    assert.equal(manager.ok, true);
    if (!manager.ok) return;
    const pod = await savePod(db, admin, {
      name: "Month pod",
      managerId: manager.id,
      niche: "General",
      sizeBand: "nano",
      creatorIds: ["abby"],
    });
    assert.equal(pod.ok, true);
    if (!pod.ok) return;

    for (const month of ["2026-13", "2026-00"]) {
      const recorded = await recordPodMetric(db, admin, { podId: pod.id, month, followers: 10, collabPosts: 1 });
      assert.equal(recorded.ok, false);
      if (!recorded.ok) assert.equal(recorded.error, "Use a month like 2026-10.");
    }

    const report = await buildMonthlyReport(db, "abby", "2026-10");
    assert.equal(report.ok, true);
    if (report.ok) assert.equal(report.report.monthLabel, "October 2026");

    const logged = await addReinvestment(db, admin, { month: "2026-10", category: "tools", amountCents: 100 });
    assert.equal(logged.ok, true);
    const money = await db.select().from(reinvestmentEntries);
    assert.deepEqual(money.map((row) => row.month), ["2026-10"]);

    const recorded = await recordPodMetric(db, admin, { podId: pod.id, month: "2026-10", followers: 10, collabPosts: 1 });
    assert.equal(recorded.ok, true);
    const metrics = await db.select().from(podMetrics).where(eq(podMetrics.podId, pod.id));
    assert.deepEqual(metrics.map((row) => row.month), ["2026-10"]);

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
