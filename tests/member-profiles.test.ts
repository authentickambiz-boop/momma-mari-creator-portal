import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { creatorNotifications, creatorProfiles, creatorRankHistory } from "../src/db/schema";
import { scrubMemberText } from "../src/lib/member-profile";
import { profileErrorCode } from "../src/lib/profile-notes";
import {
  clearProfileHold,
  listDirectoryProfiles,
  listPublicProfiles,
  memberProfile,
  moderateProfileField,
  saveMyProfile,
} from "../src/lib/profiles";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, abby, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff, 0xd9,
]);

const base = {
  creatorId: "mariclare",
  profileOn: true,
  displayName: "MariClare",
  displayNameOn: true,
  avatarOn: true,
  bio: "Stories from our kitchen table.",
  bioOn: true,
  niches: ["food"],
  nichesOn: true,
  handles: "@secret",
  handlesOn: false,
  audience: "10–50k",
  audienceOn: false,
  formats: ["TikTok"],
  formatsOn: false,
  askMe: "lunchboxes",
  askMeOn: false,
  collabs: true,
  collabsOn: false,
  state: "TX",
  stateOn: false,
  brands: "VEV $1200",
  brandsOn: true,
  childName: "Sunny",
  childAge: "6–8",
  familyOn: true,
  familyConfirm: true,
  joinedOn: true,
};

describe("member profiles", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("members see a social card, private fields stay off it, and money never shows", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    assert.equal(scrubMemberText("Under 10k"), "Under 10k");
    assert.equal(scrubMemberText("Kitchen table hello@example.com 512-555-0199 $40 minimum"), "Kitchen table");
    assert.equal(scrubMemberText("6–8"), "6–8");

    const tooLong = await saveMyProfile(db, mariclare, { ...base, bio: "a".repeat(161) });
    assert.equal(tooLong.ok, false);
    if (!tooLong.ok) assert.equal(tooLong.error, "Bio can be 160 characters.");
    assert.equal(profileErrorCode("Bio can be 160 characters."), "bio");

    const about = await saveMyProfile(db, mariclare, { ...base, snack: "x".repeat(41), familyConfirm: true });
    assert.equal(about.ok, false);
    if (!about.ok) assert.equal(about.error, "About me lines can be 40 characters.");

    const badLink = await saveMyProfile(db, mariclare, {
      ...base,
      pins: [{ url: "javascript:alert(1)", title: "Nope" }],
      pinsOn: true,
    });
    assert.equal(badLink.ok, false);
    if (!badLink.ok) assert.equal(badLink.error, "Pinned posts use an http or https link.");

    const badPhoto = await saveMyProfile(db, mariclare, { ...base, avatarBytes: Uint8Array.from([1, 2, 3, 4]), avatarFilename: "face.png" });
    assert.equal(badPhoto.ok, false);

    await db.insert(creatorRankHistory).values({
      id: "rank-mari-social",
      creatorId: "mariclare",
      score: 42,
      tier: "Gold",
      rank: 5,
      recordedOn: "2026-10-01",
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    const saved = await saveMyProfile(db, mariclare, {
      ...base,
      bio: "Kitchen table hello@example.com 512-555-0199 $40 minimum",
      avatarBytes: jpeg,
      avatarFilename: "face.jpg",
      coverBytes: jpeg,
      coverFilename: "banner.jpg",
      coverOn: true,
      platforms: [
        { platform: "TikTok", handle: "@mariclare" },
        { platform: "Twitter", handle: "nope" },
        { platform: "Instagram", handle: "mom@gmail.com" },
      ],
      platformsOn: true,
      pins: [{ url: "https://www.tiktok.com/@mariclare/video/1", title: "Lunch $12", thumb: jpeg, thumbFilename: "lunch.jpg" }],
      pinsOn: true,
      snack: "clementines",
      snackOn: false,
      loving: "slow mornings",
      lovingOn: true,
      weekend: "park walk",
      weekendOn: true,
    });
    assert.equal(saved.ok, true);

    const row = (await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, "mariclare")))[0];
    assert.equal(row?.bio, "Kitchen table");
    assert.equal(row?.safetyKinds, "[]");
    const stored = Buffer.from(row?.avatarImage ?? "", "base64");
    assert.equal(stored.includes(0xe1), false);
    assert.equal(stored[0], 0xff);
    assert.equal(stored[1], 0xd8);

    const cards = await listPublicProfiles(db);
    const hers = cards.find((card) => card.creatorId === "mariclare");
    assert.equal(hers?.displayName, "MariClare");
    assert.equal(hers?.bio, "Kitchen table");
    assert.equal(hers?.rankLabel, "Gold");
    assert.equal(hers?.rankScore, 42);
    assert.equal(hers?.avatarImage?.startsWith("data:image/jpeg;base64,"), true);
    assert.equal(hers?.coverImage?.startsWith("data:image/jpeg;base64,"), true);
    assert.deepEqual(hers?.platforms, [{ platform: "TikTok", handle: "mariclare" }]);
    assert.equal(hers?.pins?.[0]?.title, "Lunch");
    assert.equal(hers?.pins?.[0]?.thumb?.startsWith("data:image/jpeg;base64,"), true);
    assert.equal(hers?.loving, "slow mornings");
    assert.equal("snack" in (hers ?? {}), false);
    assert.equal("handles" in (hers ?? {}), false);
    assert.equal("safetyKinds" in (hers ?? {}), false);
    const packed = JSON.stringify(cards);
    assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\bminimum\b|\b\d{3}-\d{3}-\d{4}\b|mmaclamroc/i.test(packed), false);
    assert.equal(packed.includes("$"), false);

    const other = await saveMyProfile(db, abby, { ...base, creatorId: "mariclare" });
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.status, 403);

    const abbySaved = await saveMyProfile(db, abby, { ...base, creatorId: "abby", displayName: "Abby", familyOn: false, familyConfirm: true, avatarOn: false, coverOn: false });
    assert.equal(abbySaved.ok, true);
    const abbyCard = (await listPublicProfiles(db)).find((card) => card.creatorId === "abby");
    assert.equal(abbyCard?.rankLabel, "Seedling");
    assert.equal(abbyCard?.rankScore, 0);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
  });

  test("safety holds stay off Members until the owner clears them, and photos can be held on their own", async () => {
    const held = await saveMyProfile(db, mariclare, {
      ...base,
      bio: "My daughter Sunny Day loves lunch.",
      avatarBytes: jpeg,
      avatarFilename: "sunny.jpg",
      coverOn: false,
      platformsOn: false,
      pinsOn: false,
    });
    assert.equal(held.ok, true);
    const row = (await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, "mariclare")))[0];
    assert.equal(row?.safetyKinds, '["name"]');
    assert.equal(row?.safetyKinds?.includes("Sunny"), false);
    assert.equal((await listPublicProfiles(db)).some((card) => card.creatorId === "mariclare"), false);

    const owner = await listDirectoryProfiles(db, admin);
    const owned = owner.find((card) => card.creatorId === "mariclare");
    assert.equal(owned?.bio, "My daughter Sunny Day loves lunch.");
    assert.deepEqual(owned?.safetyKinds, ["name"]);
    assert.equal(JSON.stringify(owned).includes("mmaclamroc"), false);

    const creatorClear = await clearProfileHold(db, mariclare, { creatorId: "mariclare", hold: "text", reason: "I wrote it" });
    assert.equal(creatorClear.ok, false);
    const cleared = await clearProfileHold(db, admin, { creatorId: "mariclare", hold: "text", reason: "First name only in the family field." });
    assert.equal(cleared.ok, true);
    const afterClear = (await listPublicProfiles(db)).find((card) => card.creatorId === "mariclare");
    assert.equal(afterClear?.bio, "My daughter Sunny Day loves lunch.");
    assert.equal("safetyKinds" in (afterClear ?? {}), false);
    const notes = await db.select().from(creatorNotifications).where(eq(creatorNotifications.creatorId, "mariclare"));
    assert.equal(notes.some((note) => note.message.includes("cleared the hold") && !note.message.includes("Sunny")), true);

    const namedFile = await saveMyProfile(db, mariclare, {
      ...base,
      avatarBytes: jpeg,
      avatarFilename: "school-logo.jpg",
    });
    assert.equal(namedFile.ok, true);
    assert.equal((await listPublicProfiles(db)).some((card) => card.creatorId === "mariclare"), false);
    const schoolRow = (await db.select().from(creatorProfiles).where(eq(creatorProfiles.creatorId, "mariclare")))[0];
    assert.equal(schoolRow?.safetyKinds, '["school"]');
    const schoolOwner = await memberProfile(db, admin, "mariclare");
    assert.equal(JSON.stringify(schoolOwner).includes("school-logo"), false);
    assert.equal((await memberProfile(db, abby, "mariclare")), null);

    await clearProfileHold(db, admin, { creatorId: "mariclare", hold: "text", reason: "Filename reviewed." });
    const photo = await saveMyProfile(db, mariclare, {
      ...base,
      avatarBytes: jpeg,
      avatarFilename: "face.jpg",
      photoHold: true,
      coverOn: true,
      coverBytes: jpeg,
      coverFilename: "banner.jpg",
    });
    assert.equal(photo.ok, true);
    const members = (await listPublicProfiles(db)).find((card) => card.creatorId === "mariclare");
    assert.equal(members?.displayName, "MariClare");
    assert.equal("avatarImage" in (members ?? {}), false);
    assert.equal("coverImage" in (members ?? {}), false);
    const ownerPhoto = await memberProfile(db, admin, "mariclare");
    assert.equal(ownerPhoto?.photoHeld, true);
    assert.equal(ownerPhoto?.avatarImage?.startsWith("data:image/jpeg;base64,"), true);

    const uncheck = await saveMyProfile(db, mariclare, { ...base, photoHold: false });
    assert.equal(uncheck.ok, true);
    assert.equal((await memberProfile(db, admin, "mariclare"))?.photoHeld, true);
    await clearProfileHold(db, admin, { creatorId: "mariclare", hold: "photo", reason: "No school logo in the crop." });
    const shown = (await listPublicProfiles(db)).find((card) => card.creatorId === "mariclare");
    assert.equal(shown?.avatarImage?.startsWith("data:image/jpeg;base64,"), true);

    const hiddenSnack = await moderateProfileField(db, admin, { creatorId: "mariclare", field: "loving", action: "hide", reason: "Keep it light." });
    assert.equal(hiddenSnack.ok, true);
    assert.equal((await listPublicProfiles(db)).find((card) => card.creatorId === "mariclare")?.loving, undefined);
    const creatorHide = await moderateProfileField(db, mariclare, { creatorId: "abby", field: "bio", action: "hide", reason: "no" });
    assert.equal(creatorHide.ok, false);

    const page = source("src/app/directory/page.tsx");
    const detail = source("src/app/directory/[id]/page.tsx");
    const editor = source("src/app/profile/page.tsx");
    assert.match(page, /member-grid/);
    assert.match(editor, /maxLength=\{160\}/);
    assert.match(editor, /ProfileCrop/);
    assert.match(detail, /Clear text hold/);
    assert.equal(/send a message|add friend|direct message|mailto:/i.test(`${page}\n${detail}\n${editor}`), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
  });
});
