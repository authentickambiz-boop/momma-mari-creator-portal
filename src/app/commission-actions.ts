"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { showCommissionInterest } from "@/lib/commission-campaigns";
import { commissionErrorCode } from "@/lib/commission-notes";
import { currentViewer } from "@/lib/current-user";

export async function showCommissionInterestAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await showCommissionInterest(db, viewer, String(formData.get("campaignId") ?? ""));
  if (!result.ok) redirect(`/commission?commissionError=${commissionErrorCode(result.error)}`);
  redirect("/commission?saved=1");
}
