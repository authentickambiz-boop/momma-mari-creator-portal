"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { profileErrorCode } from "@/lib/profile-notes";
import { MEMBER_PLATFORMS } from "@/lib/profile-shared";
import { clearProfileHold, directoryErrorCode, hideMyProfile, moderateProfileField, saveMyProfile } from "@/lib/profiles";

function list(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value));
}

function proofValue(formData: FormData) {
  const link = String(formData.get("analyticsProof") ?? "").trim();
  if (link) return link;
  const file = formData.get("analyticsProofFile");
  if (file instanceof File && file.size > 0) {
    const name = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80);
    if (name) return `upload:${name}`;
  }
  return "";
}

async function imageField(formData: FormData, name: string, removeName: string) {
  const file = formData.get(name);
  const named = String(formData.get(`${name}Name`) ?? "");
  if (file instanceof File && file.size > 0) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), filename: named || file.name };
  }
  if (formData.get(removeName) === "1") return { bytes: null as Uint8Array | null, filename: "" };
  return { bytes: undefined, filename: "" };
}

export async function saveProfileAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const avatar = await imageField(formData, "avatarFile", "removeAvatar");
  const cover = await imageField(formData, "coverFile", "removeCover");
  const pins = [];
  for (let index = 0; index < 3; index += 1) {
    const file = formData.get(`pinThumb${index}`);
    const named = String(formData.get(`pinThumb${index}Name`) ?? "");
    let thumb: Uint8Array | null | undefined;
    let thumbFilename: string | undefined;
    if (file instanceof File && file.size > 0) {
      thumb = new Uint8Array(await file.arrayBuffer());
      thumbFilename = named || file.name;
    } else if (formData.get(`removePinThumb${index}`) === "1") {
      thumb = null;
    }
    pins.push({
      url: String(formData.get(`pinUrl${index}`) ?? ""),
      title: String(formData.get(`pinTitle${index}`) ?? ""),
      thumb,
      thumbFilename,
    });
  }
  const result = await saveMyProfile(db, viewer, {
    creatorId: String(formData.get("creatorId") ?? ""),
    profileOn: formData.get("profileOn") === "1",
    displayName: String(formData.get("displayName") ?? ""),
    displayNameOn: formData.get("displayNameOn") === "1",
    avatarOn: formData.get("avatarOn") === "1",
    avatarBytes: avatar.bytes,
    avatarFilename: avatar.filename,
    bio: String(formData.get("bio") ?? ""),
    bioOn: formData.get("bioOn") === "1",
    niches: list(formData, "niches"),
    nichesOn: formData.get("nichesOn") === "1",
    nicheOther: String(formData.get("nicheOther") ?? ""),
    avgViewers: String(formData.get("avgViewers") ?? ""),
    hoursPerWeek: String(formData.get("hoursPerWeek") ?? ""),
    streamCategories: String(formData.get("streamCategories") ?? ""),
    analyticsProof: proofValue(formData),
    handles: String(formData.get("handles") ?? ""),
    handlesOn: formData.get("handlesOn") === "1",
    audience: String(formData.get("audience") ?? ""),
    audienceOn: formData.get("audienceOn") === "1",
    formats: list(formData, "formats"),
    formatsOn: formData.get("formatsOn") === "1",
    askMe: String(formData.get("askMe") ?? ""),
    askMeOn: formData.get("askMeOn") === "1",
    collabs: formData.get("collabs") === "1",
    collabsOn: formData.get("collabsOn") === "1",
    state: String(formData.get("state") ?? ""),
    stateOn: formData.get("stateOn") === "1",
    brands: formData.getAll("brands").map((value) => String(value)).join(", "),
    brandsOn: formData.get("brandsOn") === "1",
    childName: String(formData.get("childName") ?? ""),
    childAge: String(formData.get("childAge") ?? ""),
    familyOn: formData.get("familyOn") === "1",
    familyConfirm: formData.get("familyConfirm") === "1",
    joinedOn: formData.get("joinedOn") === "1",
    coverBytes: cover.bytes,
    coverFilename: cover.filename,
    coverOn: formData.get("coverOn") === "1",
    platforms: MEMBER_PLATFORMS.map((platform) => ({
      platform,
      handle: String(formData.get(`platform-${platform}`) ?? ""),
      url: String(formData.get(`platform-url-${platform}`) ?? ""),
      followers: String(formData.get(`platform-followers-${platform}`) ?? ""),
    })),
    platformsOn: formData.get("platformsOn") === "1",
    pins,
    pinsOn: formData.get("pinsOn") === "1",
    snack: String(formData.get("snack") ?? ""),
    snackOn: formData.get("snackOn") === "1",
    loving: String(formData.get("loving") ?? ""),
    lovingOn: formData.get("lovingOn") === "1",
    weekend: String(formData.get("weekend") ?? ""),
    weekendOn: formData.get("weekendOn") === "1",
    photoHold: formData.get("photoHold") === "1",
  });
  if (!result.ok) redirect(`/profile?profileError=${profileErrorCode(result.error)}`);
  redirect("/profile?saved=1");
}

export async function hideProfileAction() {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await hideMyProfile(db, viewer);
  if (!result.ok) redirect(`/profile?profileError=${profileErrorCode(result.error)}`);
  redirect("/profile?saved=1");
}

export async function moderateProfileAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const action = formData.get("moderation") === "reset" ? "reset" : "hide";
  const result = await moderateProfileField(db, viewer, {
    creatorId: String(formData.get("creatorId") ?? ""),
    field: String(formData.get("field") ?? ""),
    action,
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) redirect(`/directory?directoryError=${directoryErrorCode(result.error)}`);
  redirect("/directory?saved=1");
}

export async function clearProfileHoldAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const creatorId = String(formData.get("creatorId") ?? "");
  const hold = formData.get("hold") === "photo" ? "photo" : "text";
  const result = await clearProfileHold(db, viewer, {
    creatorId,
    hold,
    reason: String(formData.get("reason") ?? ""),
  });
  const path = /^[a-z0-9-]{1,64}$/.test(creatorId) ? `/directory/${creatorId}` : "/directory";
  if (!result.ok) redirect(`${path}?directoryError=${directoryErrorCode(result.error)}`);
  redirect(`${path}?saved=1`);
}
