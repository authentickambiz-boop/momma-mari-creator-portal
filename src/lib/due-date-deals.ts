import { inArray } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { deals, gmailBridgeThreads } from "@/db/schema";
import { isAutomatedSender } from "./gmail-live";
import { listDealsForViewer } from "./queries";
import type { DealSummary, Viewer } from "./types";

type ThreadMark = { classification: string; fromEmail: string; brand: string };

function automatedParty(value: string) {
  const text = value.trim();
  return Boolean(text) && isAutomatedSender(text);
}

/** A due-date choice is a real brand deal. Bots, no-reply, GitHub, and "not a deal" threads are not. */
export function isRealBrandDeal(
  deal: { brand: string; contact?: string | null },
  threads: ThreadMark[] = [],
) {
  if (threads.some((thread) => thread.classification === "not_deal")) return false;
  const brand = deal.brand.trim();
  if (!brand) return false;
  const contact = deal.contact?.trim() ?? "";
  if (automatedParty(brand) || (contact && automatedParty(contact))) return false;
  if (contact.includes("@") && automatedParty(`${brand} <${contact}>`)) return false;
  return !threads.some((thread) => automatedParty(thread.fromEmail) || automatedParty(thread.brand));
}

/** Deals the signed-in user may schedule. Same visibility as the rest of the portal, then the brand filter. */
export async function listDueDateDeals(db: PortalDb, viewer: Viewer, creatorId: string | "all"): Promise<DealSummary[]> {
  const visible = await listDealsForViewer(db, viewer, creatorId);
  if (visible.length === 0) return [];
  const ids = visible.map((deal) => deal.id);
  const [rows, threads] = await Promise.all([
    db.select({
      id: deals.id,
      brand: deals.brand,
      contact: deals.contact,
      gmailThreadId: deals.gmailThreadId,
    }).from(deals).where(inArray(deals.id, ids)),
    db.select({
      dealId: gmailBridgeThreads.dealId,
      threadId: gmailBridgeThreads.threadId,
      classification: gmailBridgeThreads.classification,
      fromEmail: gmailBridgeThreads.fromEmail,
      brand: gmailBridgeThreads.brand,
    }).from(gmailBridgeThreads),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return visible.filter((deal) => {
    const row = byId.get(deal.id);
    if (!row) return false;
    const linked = threads.filter((thread) => thread.dealId === row.id || (row.gmailThreadId !== null && thread.threadId === row.gmailThreadId));
    return isRealBrandDeal(
      { brand: row.brand, contact: row.contact },
      linked.map((thread) => ({ classification: thread.classification, fromEmail: thread.fromEmail, brand: thread.brand })),
    );
  });
}
