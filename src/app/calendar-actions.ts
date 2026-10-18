"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { saveDeliverableDate, setCalendarConnected } from "@/lib/calendar";
import { currentViewer } from "@/lib/current-user";

export async function saveDeliverableDateAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveDeliverableDate(db, {
    dealId: String(formData.get("dealId") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    dueOn: String(formData.get("dueOn") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`/calendar?calendarError=${encodeURIComponent(result.error)}`);
  redirect("/calendar?saved=1");
}

export async function connectCalendarAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setCalendarConnected(db, viewer, formData.get("connected") === "1");
  if (!result.ok) redirect(`/calendar?calendarError=${encodeURIComponent(result.error)}`);
  redirect("/calendar?saved=1");
}
