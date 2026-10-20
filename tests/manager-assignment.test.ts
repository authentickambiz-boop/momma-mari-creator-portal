import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { capabilityAudit, deals } from "../src/db/schema";
import { upsertDeal } from "../src/lib/bot-api";
import {
  TRAINING_ITEMS,
  managerAct,
  setCapabilityLevel,
  setTrainingChecks,
} from "../src/lib/capabilities";
import { addManager, assignCreatorManagers } from "../src/lib/managers";
import { getDealForViewer } from "../src/lib/queries";
import type { Viewer } from "../src/lib/types";
import { admin, openTestDb } from "./harness";

describe("manager assignment", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a manager can act only for creators on their list, and KOSBLING stays put", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const kosblingStep = kosblingBefore?.nextStep;

    const added = await addManager(db, { actorRole: "admin", name: "Riley List", email: "riley.list@gmail.com" });
    assert.equal(added.ok, true);
    if (!added.ok) return;
    const assigned = await assignCreatorManagers(db, {
      actorRole: "admin",
      creatorId: "mariclare",
      primaryManagerId: added.id,
      backupManagerId: null,
    });
    assert.equal(assigned.ok, true);
    const trained = await setTrainingChecks(db, {
      actorRole: "admin",
      actorEmail: admin.email,
      subjectType: "manager",
      subjectId: added.id,
      capability: "negotiate",
      checked: TRAINING_ITEMS.negotiate.map((item) => item.id),
    });
    assert.equal(trained.ok, true);
    const level = await setCapabilityLevel(db, {
      actorRole: "admin",
      actorEmail: admin.email,
      subjectType: "manager",
      subjectId: added.id,
      capability: "negotiate",
      level: "full",
    });
    assert.equal(level.ok, true);

    const mari = await upsertDeal(db, {
      id: "list-mari",
      brand: "List Soap",
      creatorId: "mariclare",
      status: "negotiating",
      workflowStage: "offer_shared",
      visibleToCreator: true,
      nextStep: "leave mari",
    });
    assert.equal(mari.status, 201);
    const abby = await upsertDeal(db, {
      id: "list-abby",
      brand: "List Glow",
      creatorId: "abby",
      status: "negotiating",
      workflowStage: "offer_shared",
      visibleToCreator: true,
      nextStep: "leave abby",
    });
    assert.equal(abby.status, 201);

    const fromDatabase: Viewer = {
      email: added.email,
      role: "manager",
      creatorId: null,
      name: "Riley List",
      managerId: added.id,
    };
    const missing = await managerAct(db, fromDatabase, {
      capability: "negotiate",
      summary: "Missing deal",
      effect: { kind: "negotiate", dealId: "missing-deal", note: "no" },
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.status, 404);
      assert.equal(missing.error, "Deal not found.");
    }

    const allowed = await managerAct(db, fromDatabase, {
      capability: "negotiate",
      summary: "Update the next step",
      effect: { kind: "negotiate", dealId: "list-mari", note: "from the list" },
    });
    assert.equal(allowed.ok, true);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "list-mari")))[0]?.nextStep, "from the list");

    const auditBefore = (await db.select().from(capabilityAudit)).length;
    const refused = await managerAct(db, fromDatabase, {
      capability: "negotiate",
      summary: "Should not land",
      effect: { kind: "negotiate", dealId: "list-abby", note: "not abby" },
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.status, 403);
      assert.equal(refused.error, "That creator is not on your list.");
    }
    assert.equal((await db.select().from(deals).where(eq(deals.id, "list-abby")))[0]?.nextStep, "leave abby");
    assert.equal((await db.select().from(capabilityAudit)).length, auditBefore);

    const onlyAbby: Viewer = { ...fromDatabase, assignedCreatorIds: ["abby"] };
    const kosblingTry = await managerAct(db, onlyAbby, {
      capability: "negotiate",
      summary: "Touch KOSBLING",
      effect: { kind: "negotiate", dealId: "kosbling", note: "should not land" },
    });
    assert.equal(kosblingTry.ok, false);
    if (!kosblingTry.ok) assert.equal(kosblingTry.error, "That creator is not on your list.");
    const abbyAct = await managerAct(db, onlyAbby, {
      capability: "negotiate",
      summary: "Abby step",
      effect: { kind: "negotiate", dealId: "list-abby", note: "abby step" },
    });
    assert.equal(abbyAct.ok, true);
    assert.equal((await db.select().from(deals).where(eq(deals.id, "list-abby")))[0]?.nextStep, "abby step");

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, "draft_due");
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.nextStep, kosblingStep);
    assert.equal(kosblingAfter?.drafts.length, kosblingDrafts);
    assert.equal(kosblingAfter?.contracts.length, 0);
    assert.equal(kosblingAfter?.stageEvents?.length, kosblingEvents);
  });
});
