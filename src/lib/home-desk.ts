import { shortDate } from "./format";
import { stageShortLabel } from "./stages";
import type { DealSummary } from "./types";

const SIGNED = new Set([
  "signed_by_creator",
  "signed_sent",
  "waiting_for_product",
  "product_received",
  "draft_due",
  "draft_submitted",
  "manager_review",
  "sent_to_brand",
  "brand_revisions",
  "brand_approved",
  "scheduled_posted",
  "payment_pending",
  "paid",
]);
const DRAFTED = new Set([
  "draft_due",
  "draft_submitted",
  "manager_review",
  "sent_to_brand",
  "brand_revisions",
  "brand_approved",
  "scheduled_posted",
  "payment_pending",
  "paid",
]);
const IN_REVIEW = new Set(["draft_submitted", "manager_review", "sent_to_brand", "brand_revisions"]);
const POSTED = new Set(["scheduled_posted", "payment_pending", "paid"]);

export function homeSummary(deals: DealSummary[]) {
  const active = deals.filter((deal) => deal.visibleToCreator && deal.workflowStage !== "paid" && deal.status !== "paid");
  const drafts = active.filter((deal) => deal.workflowStage != null && IN_REVIEW.has(deal.workflowStage));
  const dated = active
    .filter((deal) => Boolean(deal.postDate?.trim()))
    .sort((left, right) => String(left.postDate).localeCompare(String(right.postDate)));
  const next = dated[0] ?? null;
  const payout = active.find((deal) => deal.workflowStage === "payment_pending");
  return {
    activeCount: active.length,
    draftCount: drafts.length,
    nextPost: next ? { brand: next.brand, when: shortDate(next.postDate) || next.postDate || "" } : null,
    payoutLabel: payout?.earningsChipText?.trim() || "No payout waiting",
  };
}

export function progressMarks(stage: string | null | undefined) {
  return [SIGNED.has(stage ?? ""), DRAFTED.has(stage ?? ""), IN_REVIEW.has(stage ?? "") || POSTED.has(stage ?? ""), POSTED.has(stage ?? "")];
}

export function taskCopy(deal: DealSummary) {
  const stage = deal.workflowStage;
  if (stage === "draft_due") return { title: "Upload your draft", action: "Upload draft" };
  if (stage === "awaiting_signature" || stage === "approved_by_agency") return { title: "Review and sign your agreement", action: "Open contract" };
  if (stage === "brand_revisions") return { title: "Brand left notes on the draft", action: "Open deal" };
  const label = stageShortLabel(stage);
  return { title: label || deal.brand, action: "Open deal" };
}

export function brandInitials(brand: string) {
  const parts = brand.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "M";
}
