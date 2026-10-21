"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { openBrandReport } from "@/lib/brand-report";
import { currentViewer } from "@/lib/current-user";

export async function openBrandReportAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await openBrandReport(db, viewer, String(formData.get("dealId") ?? ""));
  if (!result.ok) redirect("/dashboard?report=missing");
  redirect(`/brand-report/${result.token}`);
}
