import type { DealStatus } from "./types";

export type StageActorRole = "admin" | "manager" | "bot" | "system" | "creator";

export type DealStage = {
  id: string;
  /** Position on the creator step bar. Side exits are not on the bar. */
  order: number | null;
  shortLabel: string;
  adminLabel: string;
  /** Coarse status kept for the existing lists. Null leaves the current status alone. */
  bucket: DealStatus | null;
  /** Old 5-step video bar, when this stage still lines up with it. */
  videoStep: number | null;
  onTrack: boolean;
  creatorMessage: (brand: string) => string;
};

function message(text: string) {
  return () => text;
}

function withBrand(template: (brand: string) => string) {
  return template;
}

export const DEAL_STAGES: DealStage[] = [
  {
    id: "offer_received",
    order: 1,
    shortLabel: "Offer in",
    adminLabel: "Offer received",
    bucket: "pitch",
    videoStep: null,
    onTrack: true,
    creatorMessage: message("This offer is not shared yet."),
  },
  {
    id: "offer_shared",
    order: 2,
    shortLabel: "Shared with you",
    adminLabel: "Offer shared with creator",
    bucket: "pitch",
    videoStep: null,
    onTrack: true,
    creatorMessage: withBrand((brand) => `New offer from ${brand}. The pay, deliverables, dates, and usage rights are below.`),
  },
  {
    id: "creator_interested",
    order: 3,
    shortLabel: "You're interested",
    adminLabel: "Creator interested",
    bucket: "pitch",
    videoStep: null,
    onTrack: true,
    creatorMessage: withBrand((brand) => `Got it! We're letting ${brand} know.`),
  },
  {
    id: "interest_sent",
    order: 4,
    shortLabel: "Told the brand",
    adminLabel: "Interest sent to brand",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: withBrand((brand) => `We told ${brand} you're in. Waiting on their contract.`),
  },
  {
    id: "contract_received",
    order: 5,
    shortLabel: "Contract in",
    adminLabel: "Contract received",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: message("Contract is in. We're reviewing it for you."),
  },
  {
    id: "contract_review",
    order: 6,
    shortLabel: "In review",
    adminLabel: "Contract under review",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: message("We're reviewing the contract."),
  },
  {
    id: "revisions_requested",
    order: 7,
    shortLabel: "Changes asked",
    adminLabel: "Revisions requested",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: withBrand((brand) => `We asked ${brand} for a few changes to protect you.`),
  },
  {
    id: "revised_contract",
    order: 8,
    shortLabel: "New contract",
    adminLabel: "Revised contract received",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: message("We're reviewing the contract."),
  },
  {
    id: "approved_by_agency",
    order: 9,
    shortLabel: "Team approved",
    adminLabel: "Approved by Momma Mari",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: message("Contract approved by your team. Ready for you to sign."),
  },
  {
    id: "awaiting_signature",
    order: 10,
    shortLabel: "Ready to sign",
    adminLabel: "Awaiting creator signature",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: message("The contract is ready for you to sign."),
  },
  {
    id: "signed_by_creator",
    order: 11,
    shortLabel: "You signed",
    adminLabel: "Signed by creator",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: message("Signed. Your copy will be here when it's saved."),
  },
  {
    id: "signed_sent",
    order: 12,
    shortLabel: "Contract sent",
    adminLabel: "Signed contract sent to brand",
    bucket: "negotiating",
    videoStep: null,
    onTrack: true,
    creatorMessage: withBrand((brand) => `Signed contract sent to ${brand}.`),
  },
  {
    id: "waiting_for_product",
    order: 13,
    shortLabel: "Waiting on product",
    adminLabel: "Waiting for product",
    bucket: "active",
    videoStep: null,
    onTrack: true,
    creatorMessage: withBrand((brand) => `Waiting on product from ${brand}.`),
  },
  {
    id: "product_received",
    order: 14,
    shortLabel: "Product arrived",
    adminLabel: "Product received",
    bucket: "active",
    videoStep: 0,
    onTrack: true,
    creatorMessage: message("Got it. Your draft due date is below."),
  },
  {
    id: "draft_due",
    order: 15,
    shortLabel: "Draft due",
    adminLabel: "Draft due",
    bucket: "active",
    videoStep: 0,
    onTrack: true,
    creatorMessage: message("The brief, deliverables, due date, and upload box are below."),
  },
  {
    id: "draft_submitted",
    order: 16,
    shortLabel: "Draft in",
    adminLabel: "Draft submitted",
    bucket: "active",
    videoStep: 1,
    onTrack: true,
    creatorMessage: message("Draft uploaded. Your manager is reviewing it."),
  },
  {
    id: "manager_review",
    order: 17,
    shortLabel: "Manager review",
    adminLabel: "Manager review",
    bucket: "active",
    videoStep: 1,
    onTrack: true,
    creatorMessage: withBrand((brand) => `Your manager is reviewing the draft before it can go to ${brand}.`),
  },
  {
    id: "sent_to_brand",
    order: 18,
    shortLabel: "Sent to brand",
    adminLabel: "Sent to brand",
    bucket: "active",
    videoStep: 2,
    onTrack: true,
    creatorMessage: withBrand((brand) => `Sent to ${brand}. Waiting on their feedback.`),
  },
  {
    id: "brand_revisions",
    order: 19,
    shortLabel: "Brand notes",
    adminLabel: "Brand revisions",
    bucket: "active",
    videoStep: 2,
    onTrack: true,
    creatorMessage: withBrand((brand) => `${brand} asked for changes. Their notes are in the history below.`),
  },
  {
    id: "brand_approved",
    order: 20,
    shortLabel: "Brand approved",
    adminLabel: "Brand approved",
    bucket: "active",
    videoStep: 3,
    onTrack: true,
    creatorMessage: withBrand((brand) => `${brand} approved your video. The post date is below.`),
  },
  {
    id: "scheduled_posted",
    order: 21,
    shortLabel: "Posted",
    adminLabel: "Scheduled / Posted",
    bucket: "delivered",
    videoStep: 4,
    onTrack: true,
    creatorMessage: message("The post date is below, along with any link-in-bio reminder."),
  },
  {
    id: "payment_pending",
    order: 22,
    shortLabel: "Payment due",
    adminLabel: "Payment pending",
    bucket: "delivered",
    videoStep: 4,
    onTrack: true,
    creatorMessage: withBrand((brand) => `${brand} still owes the fee. The amount and due date are below.`),
  },
  {
    id: "paid",
    order: 23,
    shortLabel: "Paid",
    adminLabel: "Paid",
    bucket: "paid",
    videoStep: 4,
    onTrack: true,
    creatorMessage: message("Paid. Your share is on the Earnings page."),
  },
  {
    id: "creator_declined",
    order: null,
    shortLabel: "Passed",
    adminLabel: "Creator declined",
    bucket: "pitch",
    videoStep: null,
    onTrack: false,
    creatorMessage: message("Passed. This deal is off your list."),
  },
  {
    id: "brand_quiet",
    order: null,
    shortLabel: "Brand quiet",
    adminLabel: "Brand went quiet",
    bucket: null,
    videoStep: null,
    onTrack: false,
    creatorMessage: withBrand((brand) => `${brand} has gone quiet. We'll update you when there's news.`),
  },
  {
    id: "cancelled",
    order: null,
    shortLabel: "Cancelled",
    adminLabel: "Cancelled / kill fee",
    bucket: null,
    videoStep: null,
    onTrack: false,
    creatorMessage: message("This deal was cancelled. Kamron will tell you if anything else is needed."),
  },
  {
    id: "on_hold",
    order: null,
    shortLabel: "On hold",
    adminLabel: "On hold",
    bucket: null,
    videoStep: null,
    onTrack: false,
    creatorMessage: message("This deal is on hold. Nothing is needed from you right now."),
  },
];

const BY_ID = new Map(DEAL_STAGES.map((stage) => [stage.id, stage]));

export function getDealStage(id: string | null | undefined) {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function isDealStage(id: string) {
  return BY_ID.has(id);
}

export function trackStages() {
  return DEAL_STAGES.filter((stage) => stage.onTrack);
}

export function sideStages() {
  return DEAL_STAGES.filter((stage) => !stage.onTrack);
}

export function stageAdminLabel(id: string | null | undefined) {
  return getDealStage(id)?.adminLabel ?? id ?? "Not set";
}

export function stageShortLabel(id: string | null | undefined) {
  return getDealStage(id)?.shortLabel ?? id ?? "";
}

export function creatorStageMessage(id: string | null | undefined, brand: string) {
  const stage = getDealStage(id);
  if (!stage) return "";
  return stage.creatorMessage(brand);
}

/** How 0006 maps the old status, plus the old 5-step video number when one was stored. */
export function workflowStageForLegacy(status: string, videoStep: number | null) {
  if (status === "paid") return "paid";
  if (status === "delivered") return "scheduled_posted";
  if (status === "pitch") return "offer_received";
  if (status === "negotiating") return "contract_review";
  if (status === "active") return workflowStageForVideoStep(videoStep) ?? "draft_due";
  return "offer_received";
}

/** The old `stage` number was a 0-based index on the 5-step video bar. */
export function workflowStageForVideoStep(videoStep: number | null) {
  if (videoStep === null || videoStep === undefined) return null;
  if (videoStep <= 0) return "draft_due";
  if (videoStep === 1) return "manager_review";
  if (videoStep === 2) return "brand_revisions";
  if (videoStep === 3) return "brand_approved";
  if (videoStep >= 4) return "scheduled_posted";
  return null;
}
