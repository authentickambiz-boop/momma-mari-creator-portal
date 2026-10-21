import type { PortalDb } from "@/db";
import { creators } from "@/db/schema";

export const PUBLIC_ROBOTS = { index: true as const, follow: true as const };

export const PUBLIC_MARKETING_PATHS = [
  "/services",
  "/packages",
  "/roster",
  "/meet",
  "/work",
  "/our-standard",
  "/inquire",
  "/apply",
  "/apply/thanks",
  "/privacy",
  "/terms",
] as const;

/** True for the public marketing pages, with or without the portal mount prefix. */
export function isPublicMarketingPath(pathname: string, basePath = "") {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const stripped = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const path = (stripped.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (path.startsWith("/brand-report/")) return true;
  return (PUBLIC_MARKETING_PATHS as readonly string[]).includes(path);
}

export const BRAND_INQUIRY_HREF = "/inquire";
export const BRAND_INQUIRY_LABEL = "Tell us about a brand";
export const INQUIRY_SUBMIT_LABEL = "Send the brief";

/** A public count. It does not include pay, email, or ages. */
export function rosterCountLabel(count: number) {
  if (count === 1) return "1 creator on the roster.";
  return `${count} creators on the roster.`;
}

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
    body: "Meet Our Creators lists the people on the public roster, with the same follower counts on every page.",
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
