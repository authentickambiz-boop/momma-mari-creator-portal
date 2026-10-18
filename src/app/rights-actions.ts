"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { saveUsageRights } from "@/lib/usage";

export async function saveUsageRightsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const ends = String(formData.get("endsOn") ?? "").trim();
  const result = await saveUsageRights(db, {
    dealId: String(formData.get("dealId") ?? ""),
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: ends || null,
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`/rights?rightsError=${encodeURIComponent(result.error)}`);
  redirect("/rights?saved=1");
}
