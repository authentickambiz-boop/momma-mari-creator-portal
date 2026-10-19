"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { createBrandOffer, respondToOffer } from "@/lib/brand-offers";
import { dollarsToCents } from "@/lib/deal-rules";

export async function createBrandOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const creatorIds = formData.getAll("creatorId").map((value) => String(value));
  const budgets = creatorIds.flatMap((creatorId) => {
    const raw = String(formData.get(`budget-${creatorId}`) ?? "").trim();
    if (!raw) return [];
    const amountCents = dollarsToCents(raw);
    if (amountCents == null) return [{ creatorId, amountCents: -1 }];
    return [{ creatorId, amountCents }];
  });
  const result = await createBrandOffer(db, viewer, {
    brand: String(formData.get("brand") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    deliverables: formData.getAll("deliverables").map((value) => String(value)),
    platforms: formData.getAll("platforms").map((value) => String(value)),
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: String(formData.get("endsOn") ?? ""),
    nextFollowUp: String(formData.get("nextFollowUp") ?? ""),
    budgets,
  });
  if (!result.ok) redirect(`/offers?offerError=${encodeURIComponent(result.error)}`);
  redirect("/offers?saved=1");
}

export async function respondToOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await respondToOffer(db, viewer, {
    allocationId: String(formData.get("allocationId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    question: String(formData.get("question") ?? ""),
  });
  if (!result.ok) redirect(`/offers?offerError=${encodeURIComponent(result.error)}`);
  redirect("/offers?saved=1");
}
