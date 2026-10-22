"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { createBrandOffer, offerBudgetsFromRaw, respondToOffer } from "@/lib/brand-offers";
import { publicImagePageUrl } from "@/lib/promo-image";
import { promoErrorCode } from "@/lib/promo-notes";
import { savePromoVisual } from "@/lib/promo-visuals";
import { counterSharedOffer, passSharedOffer } from "@/lib/creator-interest";
import { offerErrorCode } from "@/lib/offer-notes";

export async function createBrandOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const creatorIds = formData.getAll("creatorId").map((value) => String(value));
  const parsed = offerBudgetsFromRaw(creatorIds.map((creatorId) => ({
    creatorId,
    raw: String(formData.get(`budget-${creatorId}`) ?? ""),
  })));
  if (!parsed.ok) redirect(`/offers?offerError=${offerErrorCode(parsed.error)}`);
  const productPageUrl = String(formData.get("productPageUrl") ?? "");
  const ownerImageUrl = String(formData.get("ownerImageUrl") ?? "");
  if (productPageUrl.trim() && !publicImagePageUrl(productPageUrl)) redirect("/offers?promoError=link");
  if (ownerImageUrl.trim() && !publicImagePageUrl(ownerImageUrl)) redirect("/offers?promoError=link");
  const budgets = parsed.budgets;
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
  if (!result.ok) redirect(`/offers?offerError=${offerErrorCode(result.error)}`);
  const productName = String(formData.get("productName") ?? "");
  if (productName.trim() || productPageUrl.trim() || ownerImageUrl.trim()) {
    const saved = await savePromoVisual(db, viewer, {
      subjectType: "offer",
      subjectId: result.id,
      productName,
      productPageUrl,
      ownerImageUrl,
    });
    if (!saved.ok) redirect(`/offers?promoError=${promoErrorCode(saved.error)}`);
  }
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
  if (!result.ok) redirect(`/offers?offerError=${offerErrorCode(result.error)}`);
  redirect("/offers?saved=1");
}

export async function passSharedOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const db = await getDb();
  const result = await passSharedOffer(db, {
    dealId: String(formData.get("dealId") ?? ""),
    creatorId: viewer.creatorId,
    creatorEmail: viewer.email,
    creatorName: viewer.name,
  });
  if (!result.ok) redirect(`/offers?offerError=${offerErrorCode(result.error)}`);
  redirect("/offers?saved=1");
}

export async function counterSharedOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const db = await getDb();
  const result = await counterSharedOffer(db, {
    dealId: String(formData.get("dealId") ?? ""),
    creatorId: viewer.creatorId,
    creatorName: viewer.name,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) redirect(`/offers?offerError=${offerErrorCode(result.error)}`);
  redirect("/offers?saved=1");
}
