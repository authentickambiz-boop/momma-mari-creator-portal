import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { deals, usageRights } from "@/db/schema";
import { canSeeDeal } from "./authz";
import { nowIso } from "./format";
import { assertStaffAccess } from "./managers";
import type { Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

/** Renewal suggestions only. Nothing here is charged. */
export const USAGE_CATALOG = [
  { sku: "B-UA", label: "Usage add-on", days: 30 },
  { sku: "B-UA90", label: "90-day usage", days: 90 },
  { sku: "B-UA12", label: "12-month usage", days: 365 },
  { sku: "B-UAP", label: "Perpetual usage", days: null },
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dayNumber(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function suggestUsageRenewal(startsOn: string, endsOn: string | null) {
  if (!endsOn) return USAGE_CATALOG.find((item) => item.sku === "B-UAP")!;
  const span = Math.max(1, dayNumber(endsOn) - dayNumber(startsOn));
  const timed = USAGE_CATALOG.filter((item) => item.days != null);
  return timed.reduce((best, item) => Math.abs((item.days ?? 0) - span) < Math.abs((best.days ?? 0) - span) ? item : best);
}

export function usageFlag(endsOn: string | null, today: string) {
  if (!endsOn) return null;
  const left = dayNumber(endsOn) - dayNumber(today);
  if (left < 0) return "expired" as const;
  if (left <= 30) return "soon" as const;
  return null;
}

export type UsageCard = {
  dealId: string;
  brand: string;
  startsOn: string;
  endsOn: string | null;
  flag: "expired" | "soon" | null;
  renewalSku: string;
  renewalLabel: string;
};

async function canEdit(db: PortalDb, creatorId: string, actor: { email: string; role: string }) {
  if (actor.role === "admin" || actor.role === "bot") return { ok: true as const };
  if (actor.role === "manager") {
    return assertStaffAccess(db, {
      actorEmail: actor.email,
      actorRole: "manager",
      creatorId,
      permission: "stage",
    });
  }
  return { ok: false as const, status: 403, error: "You can't change usage rights." };
}

export async function saveUsageRights(
  db: PortalDb,
  input: { dealId: string; startsOn: string; endsOn: string | null; actorEmail: string; actorRole: string },
): Promise<Result<{ id: string }>> {
  if (!isIsoDate(input.startsOn) || (input.endsOn != null && input.endsOn !== "" && !isIsoDate(input.endsOn))) {
    return { ok: false, status: 400, error: "Use dates like 2026-10-21." };
  }
  const endsOn = input.endsOn ? input.endsOn : null;
  if (endsOn && dayNumber(endsOn) < dayNumber(input.startsOn)) {
    return { ok: false, status: 400, error: "The end date has to be on or after the start." };
  }
  const dealRows = await db.select().from(deals).where(eq(deals.id, input.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const allowed = await canEdit(db, deal.creatorId, { email: input.actorEmail, role: input.actorRole });
  if (!allowed.ok) return allowed;
  const timestamp = nowIso();
  const existing = await db.select().from(usageRights).where(eq(usageRights.dealId, deal.id));
  const id = existing[0]?.id ?? crypto.randomUUID();
  if (existing[0]) {
    await db.update(usageRights).set({ startsOn: input.startsOn, endsOn, updatedAt: timestamp }).where(eq(usageRights.id, id));
  } else {
    await db.insert(usageRights).values({ id, dealId: deal.id, startsOn: input.startsOn, endsOn, createdAt: timestamp, updatedAt: timestamp });
  }
  return { ok: true, id };
}

export async function listUsageRights(db: PortalDb, viewer: Viewer, today: string): Promise<UsageCard[]> {
  const rows = await db.select().from(usageRights);
  const dealRows = await db.select().from(deals);
  const byId = new Map(dealRows.map((deal) => [deal.id, deal]));
  return rows.flatMap((row) => {
    const deal = byId.get(row.dealId);
    if (!deal || !canSeeDeal(viewer, deal)) return [];
    const renewal = suggestUsageRenewal(row.startsOn, row.endsOn);
    return [{
      dealId: deal.id,
      brand: deal.brand,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      flag: usageFlag(row.endsOn, today),
      renewalSku: renewal.sku,
      renewalLabel: renewal.label,
    }];
  }).sort((left, right) => (left.endsOn ?? "9999").localeCompare(right.endsOn ?? "9999"));
}
