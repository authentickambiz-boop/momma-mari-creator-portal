import { and, eq, isNull } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { adminNotifications, creatorNotifications, creators, deals, livePosts, usageRenewalFees, usageRights } from "@/db/schema";
import { canSeeDeal } from "./authz";
import { nowIso } from "./format";
import type { Viewer } from "./types";
import { usageChannelsLabel, usageDaysLeft } from "./usage";

/** Flag and draft window. The longer owner watch stays at 14 days. */
export const EXTENSION_LEAD_DAYS = 7;

export const EXPIRED_NOT_EXTENDED = "Expired - not extended";

export const TAKEDOWN_NOTICE = "You can take this post down if you want. Momma Mari will not remove it.";

/** Usage tier for MariClare. It is not a creator minimum and it is not written into email. */
export const MARICLARE_PAID_USAGE_NOTE = "Paid usage beyond 30 days is at least $2,500 per video for MariClare. This stays on Kamron's sign-in. It is not in the email draft, and nothing is sent.";

const POSTED_STAGES = new Set(["scheduled_posted", "payment_pending", "paid"]);

export function usageAutoRemovePostsEnabled() {
  return process.env.USAGE_AUTO_REMOVE_POSTS === "true";
}

/**
 * Off unless USAGE_AUTO_REMOVE_POSTS is true. Even then the portal does not delete a post.
 * The creator decides whether to take it down.
 */
export function considerExpiredPostRemoval() {
  const enabled = usageAutoRemovePostsEnabled();
  return { removed: false as const, enabled, reason: enabled ? "refused" as const : "off" as const };
}

export function isPostedDeal(deal: { workflowStage: string | null; status: string }, hasLivePost: boolean) {
  if (hasLivePost) return true;
  if (deal.status === "paid" || deal.status === "delivered") return true;
  return POSTED_STAGES.has(deal.workflowStage ?? "");
}

export function isPaidUsage(usageType: string | null, channelsJson: string | null) {
  const type = (usageType ?? "").toLowerCase();
  if (type.includes("paid")) return true;
  return Boolean(channelsJson && channelsJson.includes("paid_ads"));
}

export function postedUsageStatus(input: { endsOn: string | null; daysLeft: number | null; extended: boolean }) {
  if (!input.endsOn || input.daysLeft == null) return "In term";
  if (input.daysLeft < 0) return input.extended ? "Extended" : EXPIRED_NOT_EXTENDED;
  if (input.daysLeft <= EXTENSION_LEAD_DAYS) return "Ending soon";
  return "In term";
}

export function daysLeftLabel(daysLeft: number | null) {
  if (daysLeft == null) return "No end";
  if (daysLeft === 0) return "Ends today";
  if (daysLeft > 0) return daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  const ago = Math.abs(daysLeft);
  return ago === 1 ? "Ended 1 day ago" : `Ended ${ago} days ago`;
}

export function usageTypeLabel(usageType: string | null) {
  if (!usageType) return "Not set";
  if (usageType === "organic") return "Organic";
  if (usageType === "paid") return "Paid ads";
  if (usageType === "whitelisting") return "Whitelisting / Spark";
  return usageType;
}

export function mariClareUsageSuggestion(input: {
  creatorId: string;
  usageType: string | null;
  channelsJson: string | null;
  startsOn: string;
  endsOn: string | null;
  daysLeft: number | null;
}) {
  if (input.creatorId !== "mariclare") return null;
  if (!isPaidUsage(input.usageType, input.channelsJson)) return null;
  const span = input.endsOn ? usageDaysLeft(input.endsOn, input.startsOn) : null;
  const endingSoon = input.daysLeft != null && input.daysLeft >= 0 && input.daysLeft <= EXTENSION_LEAD_DAYS;
  const ended = input.daysLeft != null && input.daysLeft < 0;
  const beyond = span == null || span > 30 || endingSoon || ended;
  if (!beyond) return null;
  return MARICLARE_PAID_USAGE_NOTE;
}

export type PostedUsageRow = {
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  postLinks: string[];
  usageType: string | null;
  usageTypeLabel: string;
  channelsLabel: string;
  startsOn: string;
  endsOn: string | null;
  daysLeft: number | null;
  daysLeftLabel: string;
  status: string;
  flagged: boolean;
  extended: boolean;
  suggestion: string | null;
  takedownNotice: string | null;
};

async function postedRows(db: PortalDb, today: string): Promise<PostedUsageRow[]> {
  const [rights, dealRows, creatorRows, posts, fees] = await Promise.all([
    db.select().from(usageRights),
    db.select().from(deals),
    db.select().from(creators),
    db.select().from(livePosts),
    db.select().from(usageRenewalFees),
  ]);
  const dealsById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const creatorsById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  const postsByDeal = new Map<string, string[]>();
  for (const post of posts) {
    const list = postsByDeal.get(post.dealId) ?? [];
    if (/^https?:\/\//i.test(post.url)) list.push(post.url);
    postsByDeal.set(post.dealId, list);
  }
  const extendedKeys = new Set(fees.map((fee) => `${fee.dealId}:${fee.windowEndsOn}`));
  const rows: PostedUsageRow[] = [];
  for (const right of rights) {
    const deal = dealsById.get(right.dealId);
    if (!deal) continue;
    const links = postsByDeal.get(deal.id) ?? [];
    if (!isPostedDeal(deal, links.length > 0)) continue;
    const daysLeft = usageDaysLeft(right.endsOn, today);
    const extended = Boolean(right.endsOn && extendedKeys.has(`${deal.id}:${right.endsOn}`));
    const status = postedUsageStatus({ endsOn: right.endsOn, daysLeft, extended });
    const flagged = daysLeft != null && daysLeft >= 0 && daysLeft <= EXTENSION_LEAD_DAYS;
    rows.push({
      dealId: deal.id,
      brand: deal.brand,
      creatorId: deal.creatorId,
      creatorName: creatorsById.get(deal.creatorId)?.name ?? "Creator",
      postLinks: links,
      usageType: right.usageType,
      usageTypeLabel: usageTypeLabel(right.usageType),
      channelsLabel: usageChannelsLabel(right.channelsJson),
      startsOn: right.startsOn,
      endsOn: right.endsOn,
      daysLeft,
      daysLeftLabel: daysLeftLabel(daysLeft),
      status,
      flagged,
      extended,
      suggestion: mariClareUsageSuggestion({
        creatorId: deal.creatorId,
        usageType: right.usageType,
        channelsJson: right.channelsJson,
        startsOn: right.startsOn,
        endsOn: right.endsOn,
        daysLeft,
      }),
      takedownNotice: status === EXPIRED_NOT_EXTENDED ? TAKEDOWN_NOTICE : null,
    });
  }
  return rows.sort((left, right) => (left.endsOn ?? "9999").localeCompare(right.endsOn ?? "9999") || left.brand.localeCompare(right.brand));
}

export async function listPostedUsageWindows(db: PortalDb, viewer: Viewer, today: string): Promise<PostedUsageRow[]> {
  const [rows, dealRows] = await Promise.all([postedRows(db, today), db.select().from(deals)]);
  const dealsById = new Map(dealRows.map((deal) => [deal.id, deal]));
  return rows.flatMap((row) => {
    const deal = dealsById.get(row.dealId);
    if (!deal || !canSeeDeal(viewer, deal)) return [];
    if (viewer.role !== "admin") return [{ ...row, suggestion: null }];
    return [row];
  });
}

async function noticeOnce(
  db: PortalDb,
  input: { kind: string; creatorId: string; dealId: string; message: string; owner: boolean },
) {
  if (input.owner) {
    const existing = await db.select().from(adminNotifications).where(and(
      eq(adminNotifications.kind, input.kind),
      eq(adminNotifications.creatorId, input.creatorId),
      isNull(adminNotifications.managerId),
    ));
    if (existing.some((row) => row.message === input.message)) return false;
    await db.insert(adminNotifications).values({
      id: crypto.randomUUID(),
      kind: input.kind,
      creatorId: input.creatorId,
      managerId: null,
      message: input.message,
      createdAt: nowIso(),
      readAt: null,
    });
    return true;
  }
  const existing = await db.select().from(creatorNotifications).where(and(
    eq(creatorNotifications.dealId, input.dealId),
    eq(creatorNotifications.kind, input.kind),
  ));
  if (existing[0]) return false;
  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId: input.creatorId,
    dealId: input.dealId,
    kind: input.kind,
    message: input.message,
    createdAt: nowIso(),
    readAt: null,
  });
  return true;
}

/** Portal notices only. This does not send mail and does not remove a post. */
export async function syncPostedUsageNotices(db: PortalDb, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { owners: 0, creators: 0 };
  const rows = await postedRows(db, today);
  let owners = 0;
  let creators = 0;
  for (const row of rows) {
    if (row.status !== EXPIRED_NOT_EXTENDED || !row.endsOn) continue;
    considerExpiredPostRemoval();
    const ownerMessage = `${row.creatorName}'s usage for ${row.brand} ended on ${row.endsOn} without an extension. Status: ${EXPIRED_NOT_EXTENDED}. Nothing was emailed, and the post was not removed.`;
    const creatorMessage = `The usage window for ${row.brand} ended on ${row.endsOn} and was not extended. ${TAKEDOWN_NOTICE}`;
    if (await noticeOnce(db, { kind: "usage_expired", creatorId: row.creatorId, dealId: row.dealId, message: ownerMessage, owner: true })) owners += 1;
    if (await noticeOnce(db, { kind: "usage_takedown", creatorId: row.creatorId, dealId: row.dealId, message: creatorMessage, owner: false })) creators += 1;
  }
  return { owners, creators };
}
