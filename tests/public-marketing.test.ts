import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creators } from "../src/db/schema";
import { listBrandCrm, recordBrandInquiry } from "../src/lib/brand-crm";
import { PUBLIC_ROBOTS, publicRoster, SERVICES } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

describe("public marketing", { concurrency: 1 }, () => {
let db: PortalDb;
before(() => {
  db = openTestDb();
});

test("the public roster grows from creators and a brand inquiry lands on the brand list", async () => {
  const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
  const kosblingDrafts = kosblingBefore?.drafts.length;
  const kosblingEvents = kosblingBefore?.stageEvents?.length ?? 0;

  const roster = await publicRoster(db);
  for (const name of ["Abby Theriot", "AuthenticKam", "MariClare"]) {
    assert.equal(roster.some((creator) => creator.name === name), true);
  }
  for (const creator of roster) assert.deepEqual(Object.keys(creator).sort(), ["id", "initials", "name"]);
  const seeded = roster.filter((creator) => ["abby", "authentickam", "mariclare"].includes(creator.id));
  const packed = JSON.stringify(seeded);
  assert.equal(packed.includes("@"), false);
  assert.equal(packed.includes("$"), false);
  assert.equal(packed.toLowerCase().includes("rate"), false);
  assert.equal(packed.includes("gmail.com"), false);
  assert.equal(PUBLIC_ROBOTS.index, true);
  assert.equal(SERVICES.length >= 3, true);

  await db.insert(creators).values({
    id: "public-invalid",
    name: "Hidden Invalid",
    email: "hidden@example.invalid",
    handles: "@secret-handle",
    kidsAges: "secret ages",
    gmailRefreshToken: "v1:secret-token",
    initials: "HI",
    tiktokStatus: "disconnected",
    instagramStatus: "disconnected",
    facebookStatus: "disconnected",
    youtubeStatus: "disconnected",
    emailStatus: "disconnected",
    isSeed: false,
    createdAt: "2026-10-19T22:00:00.000Z",
  });
  const grown = await publicRoster(db);
  assert.equal(grown.some((creator) => creator.id === "public-invalid"), false);
  assert.equal(JSON.stringify(grown).includes("@"), false);
  assert.equal(JSON.stringify(grown).includes("secret"), false);
  await db.delete(creators).where(eq(creators.id, "public-invalid"));

  const approvalsBefore = (await db.select().from(approvalEmails)).length;
  const rejected = await recordBrandInquiry(db, { brand: "Nope Brand", contactEmail: "buyer@example.invalid", note: "skip" });
  assert.equal(rejected.ok, false);
  const saved = await recordBrandInquiry(db, {
    brand: "sample outdoor co",
    contactName: "Pat Buyer",
    contactEmail: "Pat.Buyer@SampleOutdoor.test",
    note: "Looking for a fall post.",
  });
  assert.equal(saved.ok, true);
  const list = await listBrandCrm(db, admin);
  assert.equal(list.ok, true);
  if (list.ok) {
    const card = list.brands.find((item) => item.key === "sample outdoor co");
    assert.equal(card?.brand, "Sample Outdoor Co");
    assert.equal(card?.deals.length, 0);
    assert.equal(card?.contacts.some((contact) => contact.email === "pat.buyer@sampleoutdoor.test" && contact.source === "inquiry"), true);
    assert.equal(card?.responses.some((row) => row.decision === "inquiry" && row.note === "Looking for a fall post."), true);
  }
  assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

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
