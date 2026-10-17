export function agencyTimeZone() {
  return process.env.AGENCY_TIMEZONE || "America/Chicago";
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

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:43123").replace(/\/$/, "");
}
