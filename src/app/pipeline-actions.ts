"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { movePipelineCard, setPipelineFollowUp } from "@/lib/brand-pipeline";
import { currentViewer } from "@/lib/current-user";

function fail(code: string): never {
  redirect(`/pipeline?error=${code}`);
}

export async function movePipelineAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await movePipelineCard(db, viewer, String(formData.get("cardId") ?? ""), String(formData.get("stage") ?? ""));
  if (!result.ok) fail(result.code);
  redirect("/pipeline?saved=1");
}

export async function followUpAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setPipelineFollowUp(db, viewer, String(formData.get("cardId") ?? ""), String(formData.get("nextFollowUp") ?? ""));
  if (!result.ok) fail(result.code);
  redirect("/pipeline?saved=follow");
}
