"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { recordBrandInquiry } from "@/lib/brand-crm";

export async function brandInquiryAction(formData: FormData) {
  const db = await getDb();
  const result = await recordBrandInquiry(db, {
    brand: String(formData.get("brand") ?? ""),
    contactName: String(formData.get("name") ?? ""),
    contactEmail: String(formData.get("email") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) redirect("/inquire?error=1");
  redirect("/inquire?sent=1");
}
