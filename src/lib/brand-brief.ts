import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { creators, gmailBridgeMessages, gmailBridgeThreads } from "@/db/schema";
import { recordBriefNotice } from "./brief-notify";
import { recordBrandInquiry } from "./brand-crm";
import { nowIso } from "./format";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export const BUDGET_RANGES = [
  "Under $1,000",
  "$1,000–$5,000",
  "$5,000–$10,000",
  "$10,000–$25,000",
  "$25,000+",
] as const;

export const BUDGET_KINDS = ["Paid", "Gifted", "Affiliate"] as const;

export const USAGE_CHOICES = ["Organic only", "Paid ads (Spark / whitelisting)"] as const;

export const USAGE_DURATIONS = ["30 days", "90 days", "180 days", "360 days"] as const;

export const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45"] as const;

export const PAYMENT_METHODS = ["ACH", "Wire", "PayPal"] as const;

export const HEARD_ABOUT = ["Instagram", "TikTok", "A creator", "A referral", "Search", "Other"] as const;

export const BRIEF_CREATORS = [
  { id: "mariclare", label: "MariClare" },
  { id: "authentickam", label: "AuthenticKam" },
  { id: "abby", label: "Abby" },
  { id: "recommend", label: "Recommend for me" },
] as const;

const CREATOR_IDS = new Set<string>(BRIEF_CREATORS.map((creator) => creator.id));

export type BrandBriefInput = {
  brand: string;
  companyWebsite?: string | null;
  name?: string | null;
  title?: string | null;
  email: string;
  phone?: string | null;
  agency?: string | null;
  clientBrand?: string | null;
  creators?: string[] | null;
  goal?: string | null;
  deliverables?: string | null;
  budget?: string | null;
  budgetKind?: string | null;
  usage?: string | null;
  usageDuration?: string | null;
  exclusivity?: string | null;
  timeline?: string | null;
  approvals?: string | null;
  billingContact?: string | null;
  billingEmail?: string | null;
  legalEntity?: string | null;
  poNeeded?: string | null;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
  deposit?: string | null;
  productSample?: string | null;
  heardAbout?: string | null;
  honeypot?: string | null;
};

function clip(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function line(label: string, value: string) {
  return value ? `${label}: ${value}` : null;
}

export function formatBrandBrief(input: BrandBriefInput) {
  const chosen = (input.creators ?? []).filter((id) => CREATOR_IDS.has(id));
  const creatorLabels = chosen.map((id) => BRIEF_CREATORS.find((creator) => creator.id === id)?.label ?? id);
  const usage = [clip(input.usage, 80), clip(input.usageDuration, 40), clip(input.exclusivity, 200)].filter(Boolean).join(". ");
  const payment = [clip(input.paymentTerms, 40), clip(input.paymentMethod, 40), input.deposit?.trim() ? `Deposit: ${clip(input.deposit, 20)}` : ""].filter(Boolean).join(". ");
  const billing = [clip(input.billingContact, 120), clip(input.billingEmail, 120), clip(input.legalEntity, 160), input.poNeeded?.trim() ? `PO: ${clip(input.poNeeded, 20)}` : ""].filter(Boolean).join(". ");
  const agency = input.agency?.trim().toLowerCase() === "yes"
    ? `Yes. Client: ${clip(input.clientBrand, 160) || "not named"}`
    : input.agency?.trim() ? "No" : "";
  const lines = [
    line("Website", clip(input.companyWebsite, 200)),
    line("Title", clip(input.title, 80)),
    line("Phone", clip(input.phone, 40)),
    line("Agency", agency),
    line("Creators", creatorLabels.join(", ")),
    line("Goal", clip(input.goal, 600)),
    line("Deliverables", clip(input.deliverables, 600)),
    line("Budget", [clip(input.budget, 40), clip(input.budgetKind, 40)].filter(Boolean).join(" · ")),
    line("Usage", usage),
    line("Timeline", clip(input.timeline, 400)),
    line("Approvals", clip(input.approvals, 400)),
    line("Billing", billing),
    line("Payment terms", payment),
    line("Product sample", clip(input.productSample, 20)),
    line("Heard about us", clip(input.heardAbout, 40)),
  ].filter((item): item is string => Boolean(item));
  return lines.join("\n").slice(0, 8000);
}

function inboxCreatorId(selected: string[]) {
  const named = selected.find((id) => id !== "recommend" && CREATOR_IDS.has(id));
  return named ?? "mariclare";
}

async function fileBriefInDealInbox(
  db: PortalDb,
  input: { id: string; brand: string; email: string; name: string; note: string; creatorIds: string[] },
) {
  const creatorId = inboxCreatorId(input.creatorIds);
  const people = await db.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId));
  if (!people[0]) return;
  const timestamp = nowIso();
  const threadId = `brief-${input.id}`;
  const subject = `Brand brief: ${input.brand.trim().slice(0, 120)}`;
  const snippet = input.note.slice(0, 280);
  await db.insert(gmailBridgeThreads).values({
    id: input.id,
    creatorId,
    mailbox: "website",
    threadId,
    dealId: null,
    brand: input.brand.trim().slice(0, 160),
    subject,
    snippet,
    fromEmail: input.email,
    classification: "inquiry",
    private: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(gmailBridgeMessages).values({
    messageId: `brief-msg-${input.id}`,
    threadRowId: input.id,
    fromEmail: input.email,
    subject,
    snippet,
    attachmentsJson: "[]",
    createdAt: timestamp,
  });
}

/** A public brand brief. It is stored on the brand list and in the deal inbox. The brand is not emailed. A staff notice is stored for Kamron. */
export async function saveBrandBrief(db: PortalDb, input: BrandBriefInput): Promise<Result<{ id: string }>> {
  if (input.honeypot?.trim()) return { ok: true, id: "dropped" };
  const creatorsChosen = (input.creators ?? []).map((id) => id.trim()).filter((id) => CREATOR_IDS.has(id));
  if (!creatorsChosen.length) {
    return { ok: false, status: 400, error: "Choose a creator, or ask us to recommend." };
  }
  if (!input.budget?.trim()) return { ok: false, status: 400, error: "Choose a budget range." };
  const note = formatBrandBrief({ ...input, creators: creatorsChosen });
  const saved = await recordBrandInquiry(db, {
    brand: input.brand,
    contactName: input.name,
    contactEmail: input.email,
    note,
  });
  if (!saved.ok) return saved;
  await fileBriefInDealInbox(db, {
    id: saved.id,
    brand: input.brand,
    email: input.email.trim().toLowerCase(),
    name: input.name?.trim() || "Brand",
    note,
    creatorIds: creatorsChosen,
  });
  await recordBriefNotice(db, {
    source: "inquire",
    sourceId: saved.id,
    brand: input.brand.trim(),
    contactName: input.name?.trim() || "Brand",
    contactEmail: input.email.trim().toLowerCase(),
    program: "inquire",
    budget: input.budget.trim(),
  });
  return saved;
}
