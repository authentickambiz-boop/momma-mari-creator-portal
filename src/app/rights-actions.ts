"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { rightsErrorCode } from "@/lib/rights-notes";
import { saveUsageRights } from "@/lib/usage";

export async function saveUsageRightsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const ends = String(formData.get("endsOn") ?? "").trim();
  const exclusivityEnds = String(formData.get("exclusivityEndsOn") ?? "").trim();
  const result = await saveUsageRights(db, {
    dealId: String(formData.get("dealId") ?? ""),
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: ends || null,
    usageType: String(formData.get("usageType") ?? ""),
    territory: String(formData.get("territory") ?? ""),
    exclusivityCategory: String(formData.get("exclusivityCategory") ?? ""),
    exclusivityEndsOn: exclusivityEnds || null,
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`/rights?rightsError=${rightsErrorCode(result.error)}`);
  redirect("/rights?saved=1");
}
