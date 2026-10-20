import type { PortalDb } from "@/db";
import { creators } from "@/db/schema";

export const PUBLIC_ROBOTS = { index: true as const, follow: true as const };

export const SERVICES = [
  {
    title: "Brand partnerships",
    body: "Momma Mari talks with brands, screens the offer, and keeps a creator's deal moving from a yes through the post.",
  },
  {
    title: "Creator management",
    body: "Contracts, drafts, posting dates, and payout tracking stay in the private portal. Each creator sees her own work.",
  },
  {
    title: "A roster that grows",
    body: "The public roster lists every creator on the Momma Mari roster. A new creator shows up when Kamron adds her. There is no separate list to edit.",
  },
] as const;

export type PublicCreator = { id: string; name: string; initials: string };

/** Creators a brand can see. Emails, handles, pay, and kids' ages stay off this list. */
export async function publicRoster(db: PortalDb): Promise<PublicCreator[]> {
  const rows = await db.select({
    id: creators.id,
    name: creators.name,
    initials: creators.initials,
    email: creators.email,
  }).from(creators);
  return rows
    .filter((row) => !row.email.toLowerCase().endsWith(".invalid"))
    .map((row) => ({ id: row.id, name: row.name, initials: row.initials }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
