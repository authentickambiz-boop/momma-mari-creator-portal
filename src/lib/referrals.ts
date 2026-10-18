import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { referralSettings, referrals } from "@/db/schema";
import { formatMoney, normalizeEmail, nowIso } from "./format";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export const REFERRAL_LAWYER_NOTE = "Have a lawyer review this referral perk before anyone is paid. Nothing is paid automatically.";

export type ReferralRow = {
  id: string;
  referrerCreatorId: string;
  referredName: string;
  referredEmail: string;
  createdAt: string;
};

export function envPerkCents() {
  const raw = process.env.REFERRAL_PERK_CENTS?.trim() ?? "";
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount < 0) return null;
  return amount;
}

export function perkLabel(cents: number | null) {
  if (cents == null) return "Perk amount is not set.";
  return `Placeholder perk: ${formatMoney(cents)}`;
}

export async function getReferralPerk(db: PortalDb) {
  const rows = await db.select().from(referralSettings).where(eq(referralSettings.id, "perk"));
  if (rows[0]) return rows[0].perkCents;
  return envPerkCents();
}

export async function setReferralPerk(
  db: PortalDb,
  input: { amountCents: number | null; actorRole: string },
): Promise<Result<{ amountCents: number | null; label: string }>> {
  if (input.actorRole !== "admin") {
    return { ok: false, status: 403, error: "Only Kamron can set the perk amount." };
  }
  if (input.amountCents != null && (!Number.isInteger(input.amountCents) || input.amountCents < 0)) {
    return { ok: false, status: 400, error: "The perk amount has to be a whole number of cents, or blank." };
  }
  const timestamp = nowIso();
  const existing = await db.select().from(referralSettings).where(eq(referralSettings.id, "perk"));
  if (existing[0]) {
    await db.update(referralSettings).set({ perkCents: input.amountCents, updatedAt: timestamp }).where(eq(referralSettings.id, "perk"));
  } else {
    await db.insert(referralSettings).values({ id: "perk", perkCents: input.amountCents, updatedAt: timestamp });
  }
  return { ok: true, amountCents: input.amountCents, label: perkLabel(input.amountCents) };
}

export async function listReferrals(db: PortalDb, creatorId: string): Promise<ReferralRow[]> {
  const rows = await db.select().from(referrals).where(eq(referrals.referrerCreatorId, creatorId));
  return rows.map((row) => ({
    id: row.id,
    referrerCreatorId: row.referrerCreatorId,
    referredName: row.referredName,
    referredEmail: row.referredEmail,
    createdAt: row.createdAt,
  }));
}

export async function recordReferral(
  db: PortalDb,
  input: {
    referrerCreatorId: string;
    referredName: string;
    referredEmail: string;
    actorEmail: string;
    actorRole: string;
    actorCreatorId: string | null;
  },
): Promise<Result<{ id: string }>> {
  if (input.actorRole === "manager") {
    return { ok: false, status: 403, error: "Referrals are for the creator and Kamron." };
  }
  if (input.actorRole === "creator" && input.actorCreatorId !== input.referrerCreatorId) {
    return { ok: false, status: 403, error: "You can only add a referral for yourself." };
  }
  if (input.actorRole !== "admin" && input.actorRole !== "creator") {
    return { ok: false, status: 403, error: "Referrals are for the creator and Kamron." };
  }
  const name = input.referredName.trim();
  const email = normalizeEmail(input.referredEmail);
  if (!name) return { ok: false, status: 400, error: "Add the person's name." };
  if (!email.includes("@") || email.endsWith(".invalid")) {
    return { ok: false, status: 400, error: "That email can't be saved." };
  }
  const id = crypto.randomUUID();
  await db.insert(referrals).values({
    id,
    referrerCreatorId: input.referrerCreatorId,
    referredName: name,
    referredEmail: email,
    createdBy: input.actorEmail,
    createdAt: nowIso(),
  });
  return { ok: true, id };
}
