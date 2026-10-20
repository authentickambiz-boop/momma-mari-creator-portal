"use server";

import { redirect } from "next/navigation";
import { addBrandCrmEntry } from "@/lib/brand-crm";
import { brandErrorCode } from "@/lib/brand-notes";
import { currentViewer } from "@/lib/current-user";
import { getDb } from "@/db/getDb";

export async function addBrandCrmEntryAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await addBrandCrmEntry(db, {
    brand: String(formData.get("brand") ?? ""),
    kind: String(formData.get("kind") ?? "response"),
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    response: String(formData.get("response") ?? ""),
    note: String(formData.get("note") ?? ""),
    actorRole: viewer.role,
    actorName: viewer.name,
  });
  if (!result.ok) redirect(`/brands?brandError=${brandErrorCode(result.error)}`);
  redirect("/brands?saved=1");
}
