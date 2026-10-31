"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { requestCommissionProduct, resolveProductRequest } from "@/lib/commission-access";
import { saveFreeHandles, saveFreeNiche, saveFreeStatNote, skipFreeOnboarding } from "@/lib/free-onboarding";
import { saveStatUpload } from "@/lib/stat-uploads";
import {
  setInviteCodeCap,
  setInviteCodeDisabled,
  setSignupCodeRequired,
} from "@/lib/signup-codes";
import { dismissWelcomeChecklist } from "@/lib/welcome-checklist";

async function viewerOrLogin() {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login?next=/");
  return viewer;
}

export async function saveFreeHandlesAction(formData: FormData) {
  const viewer = await viewerOrLogin();
  const platforms = formData.getAll("platform").map(String);
  const rows = platforms.map((platform) => ({
    platform,
    handle: String(formData.get(`handle-${platform}`) ?? ""),
    followers: String(formData.get(`followers-${platform}`) ?? ""),
    views: String(formData.get(`views-${platform}`) ?? ""),
  }));
  const result = await saveFreeHandles(await getDb(), viewer, rows);
  if (!result.ok) redirect(`/onboarding?step=handles&freeError=${result.error}`);
  redirect("/onboarding?step=niche");
}

export async function saveFreeNicheAction(formData: FormData) {
  const viewer = await viewerOrLogin();
  const result = await saveFreeNiche(await getDb(), viewer, formData.getAll("niche").map(String), String(formData.get("nicheOther") ?? ""));
  if (!result.ok) redirect(`/onboarding?step=niche&freeError=${result.error}`);
  redirect("/onboarding?step=uploads");
}

export async function saveFreeUploadsAction(formData: FormData) {
  const viewer = await viewerOrLogin();
  const db = await getDb();
  const file = formData.get("stats");
  if (file instanceof File && file.size > 0) {
    const saved = await saveStatUpload(db, viewer, {
      platform: String(formData.get("platform") ?? ""),
      fileName: file.name,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (!saved.ok) redirect(`/onboarding?step=uploads&freeError=${saved.error}`);
  }
  const note = await saveFreeStatNote(db, viewer, String(formData.get("statNote") ?? ""));
  if (!note.ok) redirect(`/onboarding?step=uploads&freeError=${note.error}`);
  redirect(note.done ? "/?onboarding=done" : "/onboarding?step=uploads&freeError=file");
}

export async function skipFreeOnboardingAction() {
  const viewer = await viewerOrLogin();
  const result = await skipFreeOnboarding(await getDb(), viewer);
  if (!result.ok) redirect(`/onboarding?freeError=${result.error}`);
  redirect("/");
}

export async function dismissChecklistAction() {
  const viewer = await viewerOrLogin();
  const result = await dismissWelcomeChecklist(await getDb(), viewer);
  if (!result.ok) redirect("/?checklist=open");
  redirect("/?checklist=dismissed");
}

export async function requestProductAction(formData: FormData) {
  const viewer = await viewerOrLogin();
  const result = await requestCommissionProduct(await getDb(), viewer, String(formData.get("campaignId") ?? ""));
  if (!result.ok) redirect(`/commission?requestError=${encodeURIComponent(result.error)}`);
  redirect("/commission?requested=1");
}

export async function resolveProductAction(formData: FormData) {
  const viewer = await viewerOrLogin();
  const status = String(formData.get("status") ?? "");
  if (status !== "approved" && status !== "declined" && status !== "cancelled") redirect("/commission?requestError=1");
  const result = await resolveProductRequest(await getDb(), viewer, String(formData.get("requestId") ?? ""), status);
  if (!result.ok) redirect(`/commission?requestError=${encodeURIComponent(result.error)}`);
  redirect("/commission?requested=1");
}

export async function signupCodeSettingAction(formData: FormData) {
  const viewer = await viewerOrLogin();
  const required = formData.get("required") === "1";
  const result = await setSignupCodeRequired(await getDb(), viewer, required);
  if (!result.ok) redirect("/settings?settingsError=1");
  redirect("/settings?saved=codes");
}

export async function inviteCodeAction(formData: FormData) {
  const viewer = await viewerOrLogin();
  const db = await getDb();
  const id = String(formData.get("codeId") ?? "");
  if (formData.get("disable") === "1") {
    const result = await setInviteCodeDisabled(db, viewer, id, true);
    if (!result.ok) redirect("/settings?settingsError=1");
  } else if (formData.get("enable") === "1") {
    const result = await setInviteCodeDisabled(db, viewer, id, false);
    if (!result.ok) redirect("/settings?settingsError=1");
  } else {
    const cap = Number(String(formData.get("cap") ?? ""));
    const result = await setInviteCodeCap(db, viewer, id, cap);
    if (!result.ok) redirect("/settings?settingsError=1");
  }
  redirect("/settings?saved=codes");
}
