"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { movePipelineCard, savePipelineCard, setPipelineFollowUp } from "@/lib/brand-pipeline";
import { currentViewer } from "@/lib/current-user";

function pipelineRedirect(formData: FormData, key: "saved" | "error", value: string): never {
  const params = new URLSearchParams();
  const creator = String(formData.get("creator") ?? "").trim();
  if (creator) params.set("creator", creator);
  params.set(key, value);
  redirect(`/pipeline?${params.toString()}`);
}

export async function movePipelineAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await movePipelineCard(db, viewer, String(formData.get("cardId") ?? ""), String(formData.get("stage") ?? ""));
  if (!result.ok) pipelineRedirect(formData, "error", result.code);
  pipelineRedirect(formData, "saved", "1");
}

export async function movePipelineToStage(cardId: string, stage: string) {
  const viewer = await currentViewer();
  if (!viewer) return { ok: false as const, status: 401, error: "Sign in again.", code: "forbidden" };
  const db = await getDb();
  return movePipelineCard(db, viewer, cardId, stage);
}

export async function followUpAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setPipelineFollowUp(db, viewer, String(formData.get("cardId") ?? ""), String(formData.get("nextFollowUp") ?? ""));
  if (!result.ok) pipelineRedirect(formData, "error", result.code);
  pipelineRedirect(formData, "saved", "follow");
}

export async function savePipelineCardAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await savePipelineCard(db, viewer, String(formData.get("cardId") ?? ""), {
    stage: String(formData.get("stage") ?? ""),
    nextFollowUp: String(formData.get("nextFollowUp") ?? ""),
    note: String(formData.get("note") ?? ""),
    value: String(formData.get("value") ?? ""),
  });
  if (!result.ok) pipelineRedirect(formData, "error", result.code);
  pipelineRedirect(formData, "saved", "card");
}
