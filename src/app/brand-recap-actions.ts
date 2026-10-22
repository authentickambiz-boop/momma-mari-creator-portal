"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import {
  importRecapSnapshots,
  importReportSnapshots,
  logRecapPost,
  saveDealRecapGoal,
  saveNextCampaignNote,
  saveRecapSnapshot,
} from "@/lib/brand-recap-edit";
import { recapErrorCode } from "@/lib/brand-recap-notes";
import { currentViewer } from "@/lib/current-user";

function back(dealId: string, error: string) {
  const id = encodeURIComponent(dealId);
  return `/brand-recaps/${id}?recapError=${recapErrorCode(error)}`;
}

export async function openRecapEditorAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "").trim();
  if (!dealId) redirect("/dashboard");
  redirect(`/brand-recaps/${encodeURIComponent(dealId)}`);
}

export async function saveRecapGoalAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await saveDealRecapGoal(db, viewer, dealId, String(formData.get("goalType") ?? ""), String(formData.get("goalTarget") ?? ""));
  if (!result.ok) redirect(back(dealId, result.error));
  redirect(`/brand-recaps/${encodeURIComponent(dealId)}?saved=goal`);
}

export async function logRecapPostAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await logRecapPost(db, viewer, {
    dealId,
    url: String(formData.get("url") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    postedOn: String(formData.get("postedOn") ?? ""),
    deliverable: String(formData.get("deliverable") ?? ""),
  });
  if (!result.ok) redirect(back(dealId, result.error));
  redirect(`/brand-recaps/${encodeURIComponent(dealId)}?saved=post`);
}

export async function saveRecapSnapshotAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const postId = String(formData.get("postId") ?? "").trim();
  const result = await saveRecapSnapshot(db, viewer, {
    dealId,
    window: String(formData.get("window") ?? ""),
    metric: String(formData.get("metric") ?? ""),
    value: String(formData.get("value") ?? ""),
    source: String(formData.get("source") ?? ""),
    postId: postId || null,
  });
  if (!result.ok) redirect(back(dealId, result.error));
  redirect(`/brand-recaps/${encodeURIComponent(dealId)}?saved=snapshot`);
}

export async function importRecapSnapshotsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await importRecapSnapshots(db, viewer, dealId, String(formData.get("import") ?? ""));
  if (!result.ok) redirect(back(dealId, result.error));
  redirect(`/brand-recaps/${encodeURIComponent(dealId)}?saved=import`);
}

export async function importReportSnapshotsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await importReportSnapshots(db, viewer, {
    dealId,
    window: String(formData.get("window") ?? ""),
    source: String(formData.get("source") ?? ""),
  });
  if (!result.ok) redirect(back(dealId, result.error));
  redirect(`/brand-recaps/${encodeURIComponent(dealId)}?saved=import`);
}

export async function saveNextCampaignNoteAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await saveNextCampaignNote(db, viewer, {
    dealId,
    milestone: String(formData.get("milestone") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) redirect(back(dealId, result.error));
  redirect(`/brand-recaps/${encodeURIComponent(dealId)}?saved=note`);
}
