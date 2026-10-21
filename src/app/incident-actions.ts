"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { incidentErrorCode } from "@/lib/incident-notes";
import { saveStatusIncident, setStatusIncidentState } from "@/lib/status-page";

export async function saveIncidentAction(formData: FormData) {
  const viewer = await currentViewer();
  const db = await getDb();
  const result = await saveStatusIncident(db, viewer, {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    state: String(formData.get("state") ?? ""),
  });
  if (!result.ok) redirect(`/status?incidentError=${incidentErrorCode(result.error)}`);
  redirect("/status?saved=1");
}

export async function resolveIncidentAction(formData: FormData) {
  const viewer = await currentViewer();
  const db = await getDb();
  const result = await setStatusIncidentState(db, viewer, String(formData.get("id") ?? ""), "resolved");
  if (!result.ok) redirect(`/status?incidentError=${incidentErrorCode(result.error)}`);
  redirect("/status?saved=1");
}
