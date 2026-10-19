"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { hideMyProfile, moderateProfileField, saveMyProfile } from "@/lib/profiles";

function list(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value));
}

export async function saveProfileAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveMyProfile(db, viewer, {
    creatorId: String(formData.get("creatorId") ?? ""),
    profileOn: formData.get("profileOn") === "1",
    displayName: String(formData.get("displayName") ?? ""),
    displayNameOn: formData.get("displayNameOn") === "1",
    avatarOn: formData.get("avatarOn") === "1",
    bio: String(formData.get("bio") ?? ""),
    bioOn: formData.get("bioOn") === "1",
    niches: list(formData, "niches"),
    nichesOn: formData.get("nichesOn") === "1",
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
  });
  if (!result.ok) redirect(`/profile?profileError=${encodeURIComponent(result.error)}`);
  redirect("/profile?saved=1");
}

export async function hideProfileAction() {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  await hideMyProfile(db, viewer);
  redirect("/profile?saved=1");
}

export async function moderateProfileAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const action = formData.get("moderation") === "reset" ? "reset" : "hide";
  await moderateProfileField(db, viewer, {
    creatorId: String(formData.get("creatorId") ?? ""),
    field: String(formData.get("field") ?? ""),
    action,
    reason: String(formData.get("reason") ?? ""),
  });
  redirect("/directory");
}
