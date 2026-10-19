import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { deals, reinvestmentEntries, reinvestmentSettings } from "@/db/schema";
import { feeAndPayout, formatMoney, nowIso } from "./format";
import type { Viewer } from "./types";

export const REINVEST_CATEGORIES = [
  { id: "tools", label: "Tools" },
  { id: "ads", label: "Ads" },
  { id: "recruiting", label: "Recruiting" },
  { id: "bonuses", label: "Creator bonuses" },
  { id: "staff", label: "Staff and managers" },
] as const;

export type ReinvestCategory = (typeof REINVEST_CATEGORIES)[number]["id"];

export const DEFAULT_REINVEST_TARGET = 70;

export async function reinvestTarget(db: PortalDb) {
  const rows = await db.select().from(reinvestmentSettings).where(eq(reinvestmentSettings.id, "default"));
  return rows[0]?.targetPercent ?? DEFAULT_REINVEST_TARGET;
}

export async function saveReinvestTarget(db: PortalDb, viewer: Viewer, percent: number) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can set the reinvestment target." };
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return { ok: false as const, error: "Use a whole percent from 0 to 100." };
  const values = { id: "default", targetPercent: percent, updatedAt: nowIso() };
  const existing = await db.select().from(reinvestmentSettings).where(eq(reinvestmentSettings.id, "default"));
  if (existing[0]) await db.update(reinvestmentSettings).set(values).where(eq(reinvestmentSettings.id, "default"));
  else await db.insert(reinvestmentSettings).values(values);
  return { ok: true as const };
}

export async function addReinvestment(db: PortalDb, viewer: Viewer, input: { month: string; category: string; amountCents: number; note?: string }) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Only an owner can log reinvestment." };
  if (!/^\d{4}-\d{2}$/.test(input.month)) return { ok: false as const, error: "Use a month like 2026-10." };
  if (!REINVEST_CATEGORIES.some((item) => item.id === input.category)) return { ok: false as const, error: "Pick a category." };
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) return { ok: false as const, error: "Enter the amount in dollars." };
  await db.insert(reinvestmentEntries).values({
    id: crypto.randomUUID(),
    month: input.month,
    category: input.category,
    amountCents: input.amountCents,
    note: input.note?.trim() || null,
    createdAt: nowIso(),
  });
  return { ok: true as const };
}

export async function monthCommissionCents(db: PortalDb, month: string) {
  const rows = await db.select().from(deals);
  const cents = rows
    .filter((deal) => deal.workflowStage !== "creator_declined" && (deal.postDate ?? "").startsWith(month))
    .reduce((sum, deal) => sum + (deal.rateCents ?? 0), 0);
  return feeAndPayout(cents).feeCents ?? 0;
}

export async function reinvestmentSummary(db: PortalDb, viewer: Viewer, month: string) {
  if (viewer.role !== "admin") return { ok: false as const, error: "Reinvestment stays on the owner's sign-in." };
  const targetPercent = await reinvestTarget(db);
  const commissionCents = await monthCommissionCents(db, month);
  const rows = (await db.select().from(reinvestmentEntries)).filter((row) => row.month === month);
  const byCategory = REINVEST_CATEGORIES.map((item) => ({
    id: item.id,
    label: item.label,
    cents: rows.filter((row) => row.category === item.id).reduce((sum, row) => sum + row.amountCents, 0),
  }));
  const spentCents = byCategory.reduce((sum, row) => sum + row.cents, 0);
  const targetCents = Math.round((commissionCents * targetPercent) / 100);
  return {
    ok: true as const,
    month,
    commissionCents,
    targetPercent,
    targetCents,
    spentCents,
    byCategory,
    placeholder: targetPercent === DEFAULT_REINVEST_TARGET,
    label: `${targetPercent}% of ${formatMoney(commissionCents)} is ${formatMoney(targetCents)}. Logged ${formatMoney(spentCents)}. Nothing is moved from here.`,
  };
}
