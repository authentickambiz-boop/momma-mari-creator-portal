import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { pricingWaitlist } from "@/db/schema";
import { normalizeEmail, nowIso } from "./format";
import { recordAnalyticsHook } from "./analytics-hooks";

export function waitlistNote(code: string | undefined) {
  if (code === "joined") return "You're on the waitlist.";
  if (code === "email") return "Enter an email address.";
  return null;
}

export async function joinPricingWaitlist(db: PortalDb, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!email.includes("@") || email.endsWith(".invalid") || email.startsWith("@") || email.endsWith("@")) {
    return { ok: false as const, code: "email" as const };
  }
  const existing = await db.select({ id: pricingWaitlist.id }).from(pricingWaitlist).where(eq(pricingWaitlist.email, email));
  if (existing[0]) {
    recordAnalyticsHook("waitlist_join");
    return { ok: true as const, already: true as const };
  }
  await db.insert(pricingWaitlist).values({
    id: crypto.randomUUID(),
    email,
    createdAt: nowIso(),
  });
  recordAnalyticsHook("waitlist_join");
  return { ok: true as const, already: false as const };
}
