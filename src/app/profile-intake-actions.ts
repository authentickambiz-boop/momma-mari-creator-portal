"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { profileIntakeErrorCode } from "@/lib/profile-intake-notes";
import { saveProfileIntake, type ProfileHandleInput } from "@/lib/profile-intake";

export async function saveProfileIntakeAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const handles: ProfileHandleInput[] = [];
  for (let index = 0; index < 6; index += 1) {
    handles.push({
      platform: String(formData.get(`platform-${index}`) ?? ""),
      handle: String(formData.get(`handle-${index}`) ?? ""),
      url: String(formData.get(`url-${index}`) ?? ""),
      followers: String(formData.get(`followers-${index}`) ?? ""),
    });
  }
  const db = await getDb();
  const result = await saveProfileIntake(db, viewer, {
    legalName: String(formData.get("legalName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? ""),
    city: String(formData.get("city") ?? ""),
    addressState: String(formData.get("addressState") ?? ""),
    zip: String(formData.get("zip") ?? ""),
    country: String(formData.get("country") ?? ""),
    handles,
  });
  if (!result.ok) redirect(`/profile/intake?intakeError=${profileIntakeErrorCode(result.error)}`);
  redirect("/profile/intake?saved=1");
}
