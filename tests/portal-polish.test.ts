import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

describe("portal polish", { concurrency: 1 }, () => {
let db: PortalDb;
before(() => {
  db = openTestDb();
});

test("a creator sees Connect accounts, and wide tables scroll on a phone", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const creatorTabs = visiblePortalTabs(mariclare).map((tab) => tab.label);
  assert.equal(creatorTabs.includes("Connect accounts"), true);
  assert.equal(creatorTabs.includes("Campaigns"), false);
  assert.equal(creatorTabs.includes("Dashboard"), false);
  assert.equal(creatorTabs.includes("Billing and usage"), false);
  const managerTabs = visiblePortalTabs({
    email: "riley.manager@gmail.com",
    role: "manager",
    creatorId: null,
    name: "Riley",
    assignedCreatorIds: ["mariclare"],
  }).map((tab) => tab.label);
  assert.equal(managerTabs.includes("Connect accounts"), true);
  assert.equal(managerTabs.includes("Dashboard"), false);
  assert.equal(visiblePortalTabs(admin).some((tab) => tab.label === "Connect accounts"), true);
  assert.equal(visiblePortalTabs(admin).some((tab) => tab.label === "Dashboard"), true);
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  assert.match(css, /\.card:has\(table\) \{ overflow-x: auto; \}/);

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
