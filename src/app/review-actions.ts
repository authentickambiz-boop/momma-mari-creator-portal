"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { dollarsToCents } from "@/lib/deal-rules";
import { askCreatorToConfirmRate, confirmAgreedRate, dealFlagQuery, editDealReview, publishDealReview, rejectDealReview, saveBrandReplyDraft } from "@/lib/deal-review";

function back(dealId: string, error?: string) {
  const query = new URLSearchParams();
  if (dealId) query.set("deal", dealId);
  if (error) query.set("reviewError", error);
  const suffix = query.toString();
  return suffix ? `/review?${suffix}` : "/review";
}

export async function publishReviewAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await publishDealReview(db, { dealId, actorEmail: viewer.email, actorRole: viewer.role });
  if (!result.ok) redirect(back(dealId, result.error));
  redirect("/review?saved=published");
}

export async function rejectReviewAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await rejectDealReview(db, { dealId, actorEmail: viewer.email, actorRole: viewer.role });
  if (!result.ok) redirect(back(dealId, result.error));
  redirect("/review?saved=rejected");
}

export async function editReviewAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const dollars = String(formData.get("rate") ?? "").trim();
  const rateCents = dollars ? dollarsToCents(dollars) : undefined;
  const result = await editDealReview(db, {
    dealId,
    actorRole: viewer.role,
    brand: String(formData.get("brand") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    postDate: String(formData.get("postDate") ?? ""),
    kamronNotes: String(formData.get("kamronNotes") ?? ""),
    productRequired: formData.get("productRequired") === "1",
    rushRevision: formData.get("rushRevision") === "1",
    rateCents: rateCents == null ? undefined : rateCents,
  });
  if (!result.ok) redirect(back(dealId, result.error));
  redirect(back(dealId));
}

export async function saveReplyDraftAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await saveBrandReplyDraft(db, {
    dealId,
    actorEmail: viewer.email,
    actorRole: viewer.role,
    body: String(formData.get("body") ?? ""),
  });
  const stay = String(formData.get("back") ?? "");
  const creator = String(formData.get("creator") ?? "");
  if (!result.ok) {
    if (stay === "deal") redirect(dealFlagQuery({ dealId, creator, replyError: result.error }));
    redirect(back(dealId, result.error));
  }
  if (stay === "deal") redirect(dealFlagQuery({ dealId, creator, reply: "saved" }));
  const saved = new URLSearchParams({ saved: "draft" });
  if (dealId) saved.set("deal", dealId);
  redirect(`/review?${saved.toString()}`);
}

export async function askRateAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await askCreatorToConfirmRate(db, { dealId: String(formData.get("dealId") ?? ""), actorRole: viewer.role });
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  if (!result.ok) redirect(dealFlagQuery({ dealId, creator, rateError: result.error }));
  redirect(dealFlagQuery({ dealId, creator, rate: "asked" }));
}

export async function confirmRateAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await confirmAgreedRate(db, {
    dealId: String(formData.get("dealId") ?? ""),
    actorRole: viewer.role,
    creatorId: viewer.creatorId,
  });
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  if (!result.ok) redirect(dealFlagQuery({ dealId, creator, rateError: result.error }));
  redirect(dealFlagQuery({ dealId, creator, rate: "confirmed" }));
}

export async function ownerDealFlagsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const dollars = String(formData.get("rate") ?? "").trim();
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  if (dollars && dollarsToCents(dollars) == null) {
    redirect(dealFlagQuery({ dealId, creator, datesError: "Enter the rate in dollars." }));
  }
  const result = await editDealReview(db, {
    dealId,
    actorRole: viewer.role,
    postDate: String(formData.get("postDate") ?? ""),
    productRequired: formData.get("productRequired") === "1",
    rushRevision: formData.get("rushRevision") === "1",
    rateCents: dollars ? dollarsToCents(dollars) ?? undefined : undefined,
  });
  if (!result.ok) redirect(dealFlagQuery({ dealId, creator, datesError: result.error }));
  redirect(dealFlagQuery({ dealId, creator, dates: "saved" }));
}
