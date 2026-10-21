"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { joinPricingWaitlist } from "@/lib/pricing-waitlist";

/** Saves an email for the plans waitlist. Nothing is emailed or charged. */
export async function joinPricingWaitlistAction(formData: FormData) {
  const db = await getDb();
  const result = await joinPricingWaitlist(db, String(formData.get("email") ?? ""));
  if (!result.ok) redirect("/pricing?waitlist=email");
  redirect("/pricing?waitlist=joined");
}
