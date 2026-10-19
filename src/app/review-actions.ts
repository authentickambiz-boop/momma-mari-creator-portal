"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { dollarsToCents } from "@/lib/deal-rules";
import { askCreatorToConfirmRate, confirmAgreedRate, editDealReview, publishDealReview, rejectDealReview, saveBrandReplyDraft } from "@/lib/deal-review";

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
  if (!result.ok) {
    if (stay === "deal") redirect(`/deals/${dealId}?replyError=1`);
    redirect(back(dealId, result.error));
  }
  if (stay === "deal") redirect(`/deals/${dealId}?reply=saved`);
  redirect(back(dealId));
}

function dealBack(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  return creator ? `/deals/${dealId}?creator=${encodeURIComponent(creator)}` : `/deals/${dealId}`;
}

export async function askRateAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  await askCreatorToConfirmRate(db, { dealId: String(formData.get("dealId") ?? ""), actorRole: viewer.role });
  redirect(dealBack(formData));
}

export async function confirmRateAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  await confirmAgreedRate(db, {
    dealId: String(formData.get("dealId") ?? ""),
    actorRole: viewer.role,
    creatorId: viewer.creatorId,
  });
  redirect(dealBack(formData));
}

export async function ownerDealFlagsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const dollars = String(formData.get("rate") ?? "").trim();
  const rateCents = dollars ? dollarsToCents(dollars) : undefined;
  await editDealReview(db, {
    dealId: String(formData.get("dealId") ?? ""),
    actorRole: viewer.role,
    postDate: String(formData.get("postDate") ?? ""),
    productRequired: formData.get("productRequired") === "1",
    rushRevision: formData.get("rushRevision") === "1",
    rateCents: rateCents == null ? undefined : rateCents,
  });
  redirect(dealBack(formData));
}
