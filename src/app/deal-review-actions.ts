"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { decideCreatorDealReview } from "@/lib/creator-deal-review";

const CODES: Record<string, string> = {
  "Only the creator can answer this offer.": "role",
  "Choose accept, counter, or pass.": "choice",
  "That offer is not on your list.": "missing",
  "You can only answer your own offers.": "own",
  "You already answered this offer.": "answered",
  "You can't accept this offer.": "closed",
  "This offer is for your information.": "info",
};

export async function decideDealReviewAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await decideCreatorDealReview(db, {
    offerId: String(formData.get("offerId") ?? ""),
    creatorId: viewer.creatorId,
    actorRole: viewer.role,
    decision: String(formData.get("decision") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) redirect(`/offers?review=${CODES[result.error] ?? "1"}`);
  redirect("/offers?review=saved");
}
