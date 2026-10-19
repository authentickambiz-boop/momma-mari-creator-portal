"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { saveOwnSettings, submitSupportMessage } from "@/lib/creator-home";

export async function saveSettingsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveOwnSettings(db, viewer, {
    emailNotices: formData.get("emailNotices") === "1",
    pushNotices: formData.get("pushNotices") === "1",
    quietHours: formData.get("quietHours") === "1",
    communityVisible: formData.get("communityVisible") === "1",
  });
  if (!result.ok) redirect(`/settings?settingsError=${encodeURIComponent(result.error)}`);
  redirect("/settings?saved=1");
}

export async function submitSupportAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await submitSupportMessage(db, viewer, {
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) redirect(`/support?supportError=${encodeURIComponent(result.error)}`);
  redirect("/support?saved=1");
}
