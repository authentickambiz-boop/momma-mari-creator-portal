"use server";

import { redirect } from "next/navigation";
import { GIFTED_TERMS_VERSION } from "@/config/gifted-terms";
import { getDb } from "@/db/getDb";
import { dollarsToCents } from "@/lib/deal-rules";
import { currentViewer } from "@/lib/current-user";
import {
  applyForGiftedOffer,
  applyForGiftedOfferByEmail,
  approveGiftedApplicant,
  createGiftedOffer,
  flagGiftedOwed,
  markGiftedDelivered,
  markGiftedPosted,
  markGiftedShipped,
} from "@/lib/gifted";

function back(path: string, error?: string, saved?: string) {
  const query = new URLSearchParams();
  if (error) query.set("giftsError", error);
  if (saved) query.set("saved", saved);
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export async function createGiftedOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await createGiftedOffer(db, {
    actorRole: viewer.role,
    actorName: viewer.name,
    brand: String(formData.get("brand") ?? ""),
    product: String(formData.get("product") ?? ""),
    photos: String(formData.get("photos") ?? ""),
    deliverable: String(formData.get("deliverable") ?? ""),
    dueOn: String(formData.get("dueOn") ?? ""),
    retailValueCents: dollarsToCents(String(formData.get("retail") ?? "")),
  });
  if (!result.ok) redirect(back("/gifts", result.error));
  redirect(back("/gifts", undefined, "posted"));
}

export async function applyGiftedOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "creator" || !viewer.creatorId) redirect(back("/gifts", "Sign in as a creator to apply."));
  const db = await getDb();
  const result = await applyForGiftedOffer(db, {
    offerId: String(formData.get("offerId") ?? ""),
    creatorId: viewer.creatorId,
    acceptTerms: formData.get("acceptTerms") === "1",
    termsVersion: String(formData.get("termsVersion") ?? ""),
  });
  if (!result.ok) redirect(back("/gifts", result.error));
  redirect(back("/gifts", undefined, "applied"));
}

export async function applyGiftedByEmailAction(formData: FormData) {
  const db = await getDb();
  const result = await applyForGiftedOfferByEmail(db, {
    offerId: String(formData.get("offerId") ?? ""),
    email: String(formData.get("email") ?? ""),
    acceptTerms: formData.get("acceptTerms") === "1",
    termsVersion: String(formData.get("termsVersion") ?? GIFTED_TERMS_VERSION),
  });
  if (!result.ok) redirect(back("/gifts/apply", result.error));
  redirect(back("/gifts/apply", undefined, "applied"));
}

async function adminMove(formData: FormData, run: (db: Awaited<ReturnType<typeof getDb>>, applicationId: string, role: string) => Promise<{ ok: boolean; error?: string }>, saved: string) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await run(db, String(formData.get("applicationId") ?? ""), viewer.role);
  if (!result.ok) redirect(back("/gifts", result.error));
  redirect(back("/gifts", undefined, saved));
}

export async function approveGiftedAction(formData: FormData) {
  return adminMove(formData, (db, applicationId, actorRole) => approveGiftedApplicant(db, { actorRole, applicationId }), "approved");
}

export async function shipGiftedAction(formData: FormData) {
  return adminMove(formData, (db, applicationId, actorRole) => markGiftedShipped(db, { actorRole, applicationId }), "shipped");
}

export async function deliverGiftedAction(formData: FormData) {
  return adminMove(formData, (db, applicationId, actorRole) => markGiftedDelivered(db, { actorRole, applicationId }), "delivered");
}

export async function flagGiftedOwedAction(formData: FormData) {
  return adminMove(formData, (db, applicationId, actorRole) => flagGiftedOwed(db, { actorRole, applicationId }), "owed");
}

export async function postGiftedAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await markGiftedPosted(db, {
    actorRole: viewer.role,
    actorCreatorId: viewer.creatorId,
    applicationId: String(formData.get("applicationId") ?? ""),
    postUrl: String(formData.get("postUrl") ?? ""),
  });
  if (!result.ok) redirect(back("/gifts", result.error));
  redirect(back("/gifts", undefined, "posted-video"));
}
