export function agencyTimeZone() {
  return process.env.AGENCY_TIMEZONE || "America/New_York";
}

export function formatMoney(cents: number) {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
}

export function compactCount(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    const rounded = Math.round(millions * 10) / 10;
    return `${rounded}M`;
  }
  if (abs >= 10_000) return `${Math.round(value / 1000)}K`;
  if (abs >= 1000) {
    const thousands = Math.round((value / 1000) * 10) / 10;
    return `${thousands}K`;
  }
  return value.toLocaleString("en-US");
}

export function commaCount(value: number) {
  return value.toLocaleString("en-US");
}

export function longDate(now: Date, timeZone = agencyTimeZone()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(now);
}

export function monthName(now: Date, timeZone = agencyTimeZone()) {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "long" }).format(now);
}

export function nextPayoutLabel(now: Date, timeZone = agencyTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const current = weekdays.indexOf(read("weekday"));
  const add = current < 0 ? 0 : (1 - current + 7) % 7;
  const utc = new Date(Date.UTC(Number(read("year")), Number(read("month")) - 1, Number(read("day")) + add, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export function joinAnd(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const AGENCY_COMMISSION_PERCENT = 20;
export const CREATOR_PAYOUT_PERCENT = 100 - AGENCY_COMMISSION_PERCENT;

/** Fee is 20% of the brand amount. The creator's cut is whatever is left, so the two always add up. */
export function feeAndPayout(amountCents: number | null) {
  if (amountCents == null) return { feeCents: null, payoutCents: null };
  const feeCents = Math.round((amountCents * AGENCY_COMMISSION_PERCENT) / 100);
  return { feeCents, payoutCents: amountCents - feeCents };
}

export function commissionLabel(amountCents: number | null) {
  if (amountCents == null) return `${AGENCY_COMMISSION_PERCENT}%`;
  const cut = Math.round((amountCents * AGENCY_COMMISSION_PERCENT) / 100);
  return `${formatMoney(cut)} (${AGENCY_COMMISSION_PERCENT}%)`;
}

export function creatorPayoutAmount(splitPercent: number | null, amountCents: number | null, payoutCents: number | null) {
  if (payoutCents != null) return formatMoney(payoutCents);
  if (splitPercent == null || amountCents == null) return "Pending";
  return formatMoney(Math.round((amountCents * splitPercent) / 100));
}

/** What a creator is allowed to see on the payout tracker. The 20% fee is
 *  calculated here. Marking a step still happens only when an owner asks. */
export function creatorPayoutTracker(payment: {
  landedDate?: string | null;
  landedAmountCents?: number | null;
  amountOwedCents?: number | null;
  paidOutDate?: string | null;
  creatorPayoutCents?: number | null;
  paymentStatus?: string | null;
} | null) {
  const basis = payment?.landedAmountCents ?? payment?.amountOwedCents ?? null;
  const share = feeAndPayout(basis);
  const payoutLabel = share.payoutCents != null
    ? formatMoney(share.payoutCents)
    : creatorPayoutAmount(null, null, payment?.creatorPayoutCents ?? null);
  return {
    brandPaidOn: payment?.landedDate ?? null,
    feeLabel: commissionLabel(basis),
    cutSentOn: payment?.paidOutDate ?? null,
    payoutLabel,
    statusLabel: paymentStatusLabel(payment?.paymentStatus ?? null, "creator"),
  };
}

export function paymentStatusLabel(status: string | null, audience: "owner" | "creator") {
  if (audience === "creator") {
    if (status === "brand_invoiced") return "Brand invoiced";
    if (status === "brand_paid") return "Brand paid Momma Mari";
    if (status === "creator_payout_pending") return "Your payout is pending";
    if (status === "creator_paid") return "Paid";
    return "Not invoiced yet";
  }
  if (status === "brand_invoiced") return "Brand invoiced";
  if (status === "brand_paid") return "Brand paid";
  if (status === "creator_payout_pending") return "Payout pending";
  if (status === "creator_paid") return "Paid";
  return "Not invoiced yet";
}

export function paymentStatusTone(status: string | null) {
  if (status === "brand_paid") return "c-blue";
  if (status === "creator_payout_pending") return "c-sun";
  if (status === "creator_paid") return "c-sage";
  return "c-gray";
}

export function creatorCutLabel(splitPercent: number | null, amountCents: number | null) {
  if (splitPercent == null) return "Pending contract";
  if (amountCents == null) return `${splitPercent}%`;
  const cut = Math.round((amountCents * splitPercent) / 100);
  return `${formatMoney(cut)} (${splitPercent}%)`;
}

export function pipelineHeadline(
  deals: { pipelineCents: number | null; pipelineName: string | null }[],
  month: string,
) {
  const rows = deals.filter((deal) => deal.pipelineCents != null && deal.pipelineName);
  const cents = rows.reduce((sum, deal) => sum + (deal.pipelineCents ?? 0), 0);
  const names = rows.map((deal) => deal.pipelineName ?? "");
  return {
    cents,
    label: rows.length ? `${month} deals if ${joinAnd(names)} all close` : "No deals in this month's close group",
  };
}

export function paidOutCents(rows: { paidOutDate: string | null; creatorPayoutCents: number | null }[]) {
  return rows.reduce((sum, row) => sum + (row.paidOutDate ? (row.creatorPayoutCents ?? 0) : 0), 0);
}

export function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export function nowIso() {
  return new Date().toISOString();
}

export function shortDate(isoDate: string | null | undefined) {
  const match = isoDate?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate?.trim() || "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)));
}

export function lastUpdatedLabel(iso: string | null | undefined) {
  if (!iso) return "Last updated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last updated";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: agencyTimeZone(),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `Last updated ${time}`;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function publicBasePath() {
  const value = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!value || value === "/") return "";
  return value.replace(/\/$/, "");
}

/** Prefix a root-relative path with the Webflow mount (/portal in production). */
export function withBasePath(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${publicBasePath()}${suffix}`;
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:43123").replace(/\/$/, "");
}
