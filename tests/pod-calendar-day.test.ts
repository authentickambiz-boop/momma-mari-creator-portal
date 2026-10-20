import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { managers } from "../src/db/schema";
import { addPodDate, listPodDates, savePod } from "../src/lib/pods";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("pod calendar day", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a pod date has to be a real day, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

    await db.insert(managers).values({
      id: "pod-day-manager",
      email: "pod.day@example.com",
      name: "Pod Day",
      active: true,
      canApproveEmail: true,
      canApproveVideo: true,
      canApproveContract: false,
      canCountersign: false,
      canPriceDeals: false,
      createdAt: "2026-10-20T00:00:00.000Z",
      deactivatedAt: null,
    });
    const pod = await savePod(db, admin, {
      name: "Day pod",
      managerId: "pod-day-manager",
      niche: "General",
      sizeBand: "nano",
      creatorIds: ["abby"],
    });
    assert.equal(pod.ok, true);
    if (!pod.ok) return;

    for (const onDate of ["2026-02-31", "2026-13-40", "2026-02-29"]) {
      const refused = await addPodDate(db, admin, { podId: pod.id, title: "Draft", onDate });
      assert.equal(refused.ok, false);
      if (!refused.ok) assert.equal(refused.error, "Add a title and a date.");
    }
    const leap = await addPodDate(db, admin, { podId: pod.id, title: "Draft", onDate: "2024-02-29" });
    assert.equal(leap.ok, true);
    const dates = await listPodDates(db, pod.id);
    assert.deepEqual(dates.map((row) => row.onDate), ["2024-02-29"]);

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
