import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creators, managers } from "../src/db/schema";
import { addManager, assignCreatorManagers, setManagerActive, setManagerPermissions } from "../src/lib/managers";
import { getDealForViewer } from "../src/lib/queries";
import { teamErrorCode, teamErrorNote } from "../src/lib/team-notes";
import { admin, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

describe("team error notes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("a refused team change keeps its sentence, and no manager is added", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const kosblingDrafts = kosblingBefore?.drafts.length;
    const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;
    const managersBefore = await db.select().from(managers);
    const mariclareBefore = (await db.select().from(creators).where(eq(creators.id, "mariclare")))[0];

    const badEmail = await addManager(db, { actorRole: "admin", name: "Pat Sample", email: "pat@samplecreator.invalid" });
    assert.equal(badEmail.ok, false);
    if (!badEmail.ok) {
      assert.equal(badEmail.error, "Enter a Google email address.");
      assert.equal(teamErrorCode(badEmail.error), "email");
    }

    const blank = await addManager(db, { actorRole: "admin", name: "  ", email: "pat@samplecreator.test" });
    assert.equal(blank.ok, false);
    if (!blank.ok) {
      assert.equal(blank.error, "Enter the manager's name.");
      assert.equal(teamErrorCode(blank.error), "name");
    }

    const owner = await addManager(db, { actorRole: "admin", name: "Kamron", email: "Kamron@mommamari.com" });
    assert.equal(owner.ok, false);
    if (!owner.ok) {
      assert.equal(owner.error, "That address is already an owner.");
      assert.equal(teamErrorCode(owner.error), "admin");
    }

    const creator = await addManager(db, { actorRole: "admin", name: "MariClare", email: "mmaclamroc@gmail.com" });
    assert.equal(creator.ok, false);
    if (!creator.ok) {
      assert.equal(creator.error, "That address already belongs to a creator.");
      assert.equal(teamErrorCode(creator.error), "creator");
    }

    const notOwner = await addManager(db, { actorRole: "creator", name: "Pat Sample", email: "pat@samplecreator.test" });
    assert.equal(notOwner.ok, false);
    if (!notOwner.ok) {
      assert.equal(notOwner.error, "Only an owner can add a manager.");
      assert.equal(teamErrorCode(notOwner.error), "owner");
    }

    const backup = await assignCreatorManagers(db, {
      actorRole: "admin",
      creatorId: "mariclare",
      primaryManagerId: "same-manager",
      backupManagerId: "same-manager",
    });
    assert.equal(backup.ok, false);
    if (!backup.ok) {
      assert.equal(backup.error, "Pick a different backup.");
      assert.equal(teamErrorCode(backup.error), "backup");
    }

    const missingCreator = await assignCreatorManagers(db, {
      actorRole: "admin",
      creatorId: "missing-creator",
      primaryManagerId: null,
      backupManagerId: null,
    });
    assert.equal(missingCreator.ok, false);
    if (!missingCreator.ok) {
      assert.equal(missingCreator.error, "Creator not found.");
      assert.equal(teamErrorCode(missingCreator.error), "who");
    }

    const gone = await setManagerActive(db, { actorRole: "admin", managerId: "missing-manager", active: false });
    assert.equal(gone.ok, false);
    if (!gone.ok) {
      assert.equal(gone.error, "Manager not found.");
      assert.equal(teamErrorCode(gone.error), "missing");
    }

    const permissions = await setManagerPermissions(db, {
      actorRole: "creator",
      managerId: "missing-manager",
      permissions: { approveEmail: false, approveVideo: false, approveContract: false, countersign: false, canPriceDeals: false },
    });
    assert.equal(permissions.ok, false);
    if (!permissions.ok) {
      assert.equal(permissions.error, "Only an owner can change a manager.");
      assert.equal(teamErrorCode(permissions.error), "change");
    }

    assert.equal(teamErrorCode("Only an owner can assign a manager."), "assign");
    assert.equal(teamErrorCode("Assign an active manager."), "active");
    assert.equal(teamErrorCode("That manager is already on the team."), "taken");
    assert.equal(teamErrorCode("nope"), "1");
    assert.equal(teamErrorNote("1"), null);
    assert.equal(teamErrorNote("hello"), null);
    assert.equal(teamErrorNote(undefined), null);
    assert.equal(teamErrorNote("email"), "Enter a Google email address.");
    assert.equal(teamErrorNote("backup"), "Pick a different backup.");

    const actions = source("src/app/actions.ts");
    const add = actions.slice(actions.indexOf("export async function addManagerAction"), actions.indexOf("export async function setManagerActiveAction"));
    assert.match(add, /teamError=\$\{teamErrorCode\(result\.error\)\}/);
    assert.equal(add.includes("teamError=1"), false);
    const active = actions.slice(actions.indexOf("export async function setManagerActiveAction"), actions.indexOf("export async function setManagerPermissionsAction"));
    assert.match(active, /teamError=\$\{teamErrorCode\(result\.error\)\}/);
    const perms = actions.slice(actions.indexOf("export async function setManagerPermissionsAction"), actions.indexOf("export async function assignManagersAction"));
    assert.match(perms, /teamError=\$\{teamErrorCode\(result\.error\)\}/);
    const assign = actions.slice(actions.indexOf("export async function assignManagersAction"), actions.indexOf("function dealBack"));
    assert.match(assign, /teamError=\$\{teamErrorCode\(result\.error\)\}/);
    assert.equal(assign.includes("teamError=1"), false);

    const page = source("src/app/team/page.tsx");
    assert.match(page, /teamErrorNote\(params\.teamError\)/);
    assert.match(page, /That was not saved\./);
    assert.match(page, /Use a real Google email that is not already an owner or a creator/);

    const managersAfter = await db.select().from(managers);
    assert.equal(managersAfter.length, managersBefore.length);
    const mariclareAfter = (await db.select().from(creators).where(eq(creators.id, "mariclare")))[0];
    assert.equal(mariclareAfter?.primaryManagerId ?? null, mariclareBefore?.primaryManagerId ?? null);
    assert.equal(mariclareAfter?.backupManagerId ?? null, mariclareBefore?.backupManagerId ?? null);

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
