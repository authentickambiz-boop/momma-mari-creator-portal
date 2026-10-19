"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { RANK_FIELDS, refreshRanks, saveRankInputs, saveRankSettings, emptyInputs, type RankFieldId } from "@/lib/creator-rank";
import { currentViewer } from "@/lib/current-user";
import { saveOwnerSnapshot } from "@/lib/analytics-snapshots";
import { dollarsToCents } from "@/lib/deal-rules";
import { addCollab, addGoal, addPodDate, addShoutout, markCollabPosted, pairCollab, recordPodMetric, savePod, setGoalProgress } from "@/lib/pods";
import { createRankReport, type ReportChoices, type ReportLevel } from "@/lib/rank-reports";
import { addReinvestment, saveReinvestTarget } from "@/lib/reinvestment";

function back(path: string, error: string): never {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}growthError=${encodeURIComponent(error)}`);
}

export async function saveRankSettingsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const weights = emptyInputs();
  for (const field of RANK_FIELDS) weights[field.id] = Number(formData.get(`weight-${field.id}`) ?? 1);
  const db = await getDb();
  const result = await saveRankSettings(db, viewer, weights, String(formData.get("cadence") ?? "weekly"));
  if (!result.ok) back("/ranking", result.error);
  redirect("/ranking?saved=1");
}

export async function saveRankInputsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const creatorId = String(formData.get("creatorId") ?? "");
  const inputs = emptyInputs();
  for (const field of RANK_FIELDS) inputs[field.id as RankFieldId] = Number(formData.get(field.id) ?? 0);
  const db = await getDb();
  const result = await saveRankInputs(db, viewer, creatorId, inputs);
  if (!result.ok) back(`/ranking?creator=${encodeURIComponent(creatorId)}`, result.error);
  redirect(`/ranking?creator=${encodeURIComponent(creatorId)}&saved=1`);
}

export async function saveAnalyticsSnapshotAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const creatorId = String(formData.get("creatorId") ?? "");
  const text = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value ? value : undefined;
  };
  const metrics: Record<string, string> = {};
  for (const key of ["followers", "views", "avgViews", "engagement", "saves"]) {
    const value = text(key);
    if (value) metrics[key] = value;
  }
  const db = await getDb();
  const result = await saveOwnerSnapshot(db, viewer, {
    creatorId,
    platform: String(formData.get("platform") ?? ""),
    capturedOn: String(formData.get("capturedOn") ?? ""),
    period: text("period") ?? null,
    metrics,
    revenueCents: text("revenue") ? dollarsToCents(text("revenue") ?? "") : null,
    merge: true,
  });
  const backTo = `/analytics?creator=${encodeURIComponent(creatorId)}`;
  if (!result.ok) redirect(`${backTo}&snapshotError=${encodeURIComponent(result.error)}`);
  redirect(`${backTo}&saved=1`);
}

export async function refreshRanksAction(_formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await refreshRanks(db, viewer);
  if (!result.ok) back("/ranking", result.error);
  redirect("/ranking?saved=1");
}

export async function createReportAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const choices: ReportChoices = {
    breakdown: formData.get("breakdown") === "1",
    strengths: formData.get("strengths") === "1",
    improve: formData.get("improve") === "1",
    trend: formData.get("trend") === "1",
    averages: formData.get("averages") === "1",
    contributors: formData.get("contributors") === "1",
    collabs: formData.get("collabs") === "1",
  };
  const db = await getDb();
  const result = await createRankReport(db, viewer, {
    level: String(formData.get("level") ?? "creator") as ReportLevel,
    subjectId: String(formData.get("subjectId") ?? "") || null,
    choices,
    showRanks: formData.get("showRanks") === "1",
  });
  if (!result.ok) back("/reports", result.error);
  redirect(`/reports?saved=1`);
}

export async function savePodAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await savePod(db, viewer, {
    name: String(formData.get("name") ?? ""),
    managerId: String(formData.get("managerId") ?? ""),
    niche: String(formData.get("niche") ?? ""),
    sizeBand: String(formData.get("sizeBand") ?? ""),
    creatorIds: formData.getAll("creatorId").map((value) => String(value)),
  });
  if (!result.ok) back("/pods", result.error);
  redirect(`/pods/${result.id}?saved=1`);
}

export async function addPodDateAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await addPodDate(db, viewer, { podId, title: String(formData.get("title") ?? ""), onDate: String(formData.get("onDate") ?? "") });
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function addCollabAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await addCollab(db, viewer, { podId, title: String(formData.get("title") ?? ""), body: String(formData.get("body") ?? "") });
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function pairCollabAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await pairCollab(db, viewer, String(formData.get("ideaId") ?? ""), String(formData.get("partnerId") ?? ""));
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function markCollabPostedAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await markCollabPosted(db, viewer, String(formData.get("ideaId") ?? ""));
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function addShoutoutAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await addShoutout(db, viewer, podId, String(formData.get("body") ?? ""));
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function addGoalAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await addGoal(db, viewer, { podId, title: String(formData.get("title") ?? ""), target: Number(formData.get("target") ?? 0) });
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function setGoalProgressAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await setGoalProgress(db, viewer, String(formData.get("goalId") ?? ""), Number(formData.get("progress") ?? 0));
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function recordPodMetricAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const podId = String(formData.get("podId") ?? "");
  const db = await getDb();
  const result = await recordPodMetric(db, viewer, {
    podId,
    month: String(formData.get("month") ?? ""),
    followers: Number(formData.get("followers") ?? 0),
    collabPosts: Number(formData.get("collabPosts") ?? 0),
  });
  if (!result.ok) back(`/pods/${podId}`, result.error);
  redirect(`/pods/${podId}?saved=1`);
}

export async function saveReinvestTargetAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveReinvestTarget(db, viewer, Number(formData.get("percent") ?? ""));
  if (!result.ok) back("/dashboard", result.error);
  redirect("/dashboard?saved=1");
}

export async function addReinvestmentAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await addReinvestment(db, viewer, {
    month: String(formData.get("month") ?? ""),
    category: String(formData.get("category") ?? ""),
    amountCents: dollarsToCents(String(formData.get("amount") ?? "")) ?? -1,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) back("/dashboard", result.error);
  redirect("/dashboard?saved=1");
}
