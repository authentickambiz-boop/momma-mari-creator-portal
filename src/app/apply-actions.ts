"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { requireViewer } from "@/lib/current-user";
import { applyReviewCode, approveCreatorApplication, declineCreatorApplication, submitCreatorApplication } from "@/lib/creator-apply";

export async function submitCreatorApplicationAction(formData: FormData) {
  const db = await getDb();
  const result = await submitCreatorApplication(db, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    handles: String(formData.get("handles") ?? ""),
    followers: String(formData.get("followers") ?? ""),
    niche: String(formData.get("niche") ?? ""),
    rates: String(formData.get("rates") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
  if (!result.ok) redirect("/apply?error=1");
  redirect("/apply/thanks");
}

export async function approveCreatorApplicationAction(formData: FormData) {
  const viewer = await requireViewer();
  const db = await getDb();
  const result = await approveCreatorApplication(db, viewer, String(formData.get("id") ?? ""));
  if (!result.ok) redirect(`/dashboard?applyError=${applyReviewCode(result.error)}`);
  redirect("/dashboard?apply=approved");
}

export async function declineCreatorApplicationAction(formData: FormData) {
  const viewer = await requireViewer();
  const db = await getDb();
  const result = await declineCreatorApplication(db, viewer, String(formData.get("id") ?? ""));
  if (!result.ok) redirect(`/dashboard?applyError=${applyReviewCode(result.error)}`);
  redirect("/dashboard?apply=declined");
}
