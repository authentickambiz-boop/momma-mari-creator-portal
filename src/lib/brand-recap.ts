import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  approvalEmails,
  brandCampaignReports,
  brandCrmEntries,
  brandRecapDrafts,
  campaignAllocations,
  campaigns,
  creatorProfiles,
  creators,
  deals,
  livePosts,
  mediaKits,
  usageRights,
} from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import { brandKey } from "./brand-crm";
import { isOwner } from "./authz";
import { nowIso, parseJson, withBasePath } from "./format";
import { publicAbsoluteUrl } from "./public-meta";
import type { Viewer } from "./types";

export const RECAP_MILESTONES = [7, 30] as const;
export type RecapMilestone = (typeof RECAP_MILESTONES)[number];

export const NOT_REPORTED = "not reported yet";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_PREFIX = "Brand recap ";
const PRIVATE_LINE = /\$|\bminimum\b|\bfloor\b|fee split|agency fee|\b80\s*\/\s*20\b|\bsplit\b|deal rule/i;

export type RecapMetrics = {
  views: string | null;
  engagement: string | null;
  clicks: string | null;
  codes: string | null;
};

export type BrandRecapCopy = {
  title: string;
  brand: string;
  creatorName: string;
  milestone: RecapMilestone;
  goLiveOn: string;
  deliverables: string[];
  contentLinks: string[];
  metrics: { label: string; value: string }[];
  usageEndsOn: string | null;
  rebookHref: string;
  shareHref: string;
  subject: string;
  body: string;
};

export type DueBrandRecap = {
  dealId: string;
  brand: string;
  creatorName: string;
  milestone: RecapMilestone;
  milestoneLabel: string;
  goLiveOn: string;
  dueOn: string;
  statusLabel: string;
  href: string | null;
};

function isCalendarDay(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A real calendar day plus a whole number of days. Invalid dates stay empty. */
export function addCalendarDays(iso: string, days: number) {
  if (!isCalendarDay(iso) || !Number.isInteger(days)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isRecapMilestone(value: number): value is RecapMilestone {
  return (RECAP_MILESTONES as readonly number[]).includes(value);
}

export function recapMilestoneLabel(days: RecapMilestone) {
  return days === 30 ? "30-day recap" : "7-day recap";
}

export function recapDueOn(goLiveOn: string, milestone: RecapMilestone) {
  return addCalendarDays(goLiveOn, milestone);
}

export function isRecapDue(goLiveOn: string, today: string, milestone: RecapMilestone) {
  const due = recapDueOn(goLiveOn, milestone);
  if (!due || !isCalendarDay(today)) return false;
  return today >= due;
}

/** A brand name from the inquire link. Control characters and markup stay off the form. */
export function brandInquiryPrefill(value: string | null | undefined) {
  const text = (value ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 120);
  return text || null;
}

export function recapInquirePath(brand: string) {
  return `/inquire?brand=${encodeURIComponent(brand.trim())}`;
}

export function publicRecapLine(value: string) {
  const text = value.trim();
  if (!text || PRIVATE_LINE.test(text)) return null;
  return text;
}

function cleanMetric(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text || PRIVATE_LINE.test(text)) return null;
  return text;
}

function metricValue(value: string | null) {
  return value?.trim() ? value.trim() : NOT_REPORTED;
}

function parseStringList(value: string | null | undefined) {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string");
}

function emailIn(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

export function recapWindowNote(milestone: RecapMilestone, goLiveOn: string) {
  return `${NOTE_PREFIX}${milestone} after ${goLiveOn}`;
}

function milestoneFromNote(note: string | null) {
  const match = note?.match(/^Brand recap (7|30) after /);
  return match ? match[1] : null;
}

function creatorFacingName(
  creator: { name: string } | undefined,
  profile: { displayName: string | null; displayNameOn: boolean } | undefined,
  kit: { displayName: string | null } | undefined,
) {
  const profileName = profile?.displayNameOn ? publicRecapLine(profile.displayName ?? "") : null;
  if (profileName) return profileName;
  const kitName = publicRecapLine(kit?.displayName ?? "");
  if (kitName) return kitName;
  return publicRecapLine(creator?.name ?? "") ?? "Creator";
}

export function composeBrandRecap(input: {
  brand: string;
  creatorName: string;
  milestone: RecapMilestone;
  goLiveOn: string;
  deliverables: string[];
  contentLinks: string[];
  metrics: RecapMetrics;
  usageEndsOn: string | null;
  inquireUrl: string;
  shareUrl: string;
}): BrandRecapCopy {
  const brand = input.brand.trim() || "Brand";
  const creatorName = input.creatorName.trim() || "Creator";
  const creatorSentence = creatorName.endsWith(".") ? creatorName : `${creatorName}.`;
  const label = recapMilestoneLabel(input.milestone);
  const deliverables = input.deliverables.map((line) => publicRecapLine(line)).filter((line): line is string => Boolean(line));
  const contentLinks = input.contentLinks.flatMap((line) => {
    const safe = publicRecapLine(line);
    return safe && /^https?:\/\//i.test(safe) ? [safe] : [];
  });
  const metrics = [
    { label: "Views", value: metricValue(cleanMetric(input.metrics.views)) },
    { label: "Engagement rate", value: metricValue(cleanMetric(input.metrics.engagement)) },
    { label: "Clicks", value: metricValue(cleanMetric(input.metrics.clicks)) },
    { label: "Codes", value: metricValue(cleanMetric(input.metrics.codes)) },
  ];
  const usageEndsOn = input.usageEndsOn && isCalendarDay(input.usageEndsOn) ? input.usageEndsOn : null;
  const usageLine = `Usage rights end date: ${usageEndsOn ?? NOT_REPORTED}`;
  const deliverableBlock = deliverables.length ? deliverables.map((line) => `- ${line}`) : [`Deliverables: ${NOT_REPORTED}`];
  const linkBlock = contentLinks.length ? contentLinks.map((line) => `- ${line}`) : [`Content links: ${NOT_REPORTED}`];
  const subject = `${label} for ${brand}`;
  const rebookHref = withBasePath(recapInquirePath(brand));
  const body = [
    "Hi,",
    "",
    `Here is the ${label} for ${brand} with ${creatorSentence}`,
    "",
    `Go-live: ${input.goLiveOn}`,
    "",
    "Deliverables",
    ...deliverableBlock,
    "",
    "Content",
    ...linkBlock,
    "",
    "Results",
    ...metrics.map((metric) => `${metric.label}: ${metric.value}`),
    "",
    usageLine,
    "",
    `Rebook or extend usage: ${input.inquireUrl}`,
    `Full recap: ${input.shareUrl}`,
    "",
    "This note is waiting for approval. Nothing has been sent.",
    "",
    "Momma Mari",
  ].join("\n");
  return {
    title: `${brand} ${label}`,
    brand,
    creatorName,
    milestone: input.milestone,
    goLiveOn: input.goLiveOn,
    deliverables,
    contentLinks,
    metrics,
    usageEndsOn,
    rebookHref,
    shareHref: input.shareUrl,
    subject,
    body,
  };
}

export function recapCopyLeaks(subject: string, body: string) {
  const text = `${subject}\n${body}`;
  return PRIVATE_LINE.test(text);
}

type DealRow = typeof deals.$inferSelect;
type ReportRow = typeof brandCampaignReports.$inferSelect;

function goLiveFor(
  deal: DealRow,
  allocations: Map<string, typeof campaignAllocations.$inferSelect>,
  campaignRows: Map<string, typeof campaigns.$inferSelect>,
) {
  const posted = deal.postDate?.trim() ?? "";
  if (isCalendarDay(posted)) return posted;
  if (!deal.offerAllocationId) return null;
  const allocation = allocations.get(deal.offerAllocationId);
  if (!allocation) return null;
  const campaign = campaignRows.get(allocation.campaignId);
  const starts = campaign?.startsOn?.trim() ?? "";
  return isCalendarDay(starts) ? starts : null;
}

function metricsFor(report: ReportRow | undefined): RecapMetrics {
  return {
    views: cleanMetric(report?.viewsLabel),
    engagement: cleanMetric(report?.engagementLabel),
    clicks: cleanMetric(report?.clicksLabel),
    codes: cleanMetric(report?.codesLabel),
  };
}

function linksFor(posts: { url: string }[], report: ReportRow | undefined) {
  const found: string[] = [];
  const add = (value: string | null | undefined) => {
    for (const part of (value ?? "").split(/\s+/)) {
      const url = publicRecapLine(part) ?? "";
      if (!/^https?:\/\//i.test(url) || found.includes(url)) continue;
      found.push(url);
    }
  };
  for (const post of posts) add(post.url);
  add(report?.contentLinks);
  return found;
}

async function loadRecapTables(db: PortalDb) {
  const [
    dealRows,
    creatorRows,
    profileRows,
    kitRows,
    draftRows,
    approvalRows,
    rightRows,
    postRows,
    reportRows,
    allocationRows,
    campaignRows,
    crmRows,
  ] = await Promise.all([
    db.select().from(deals),
    db.select().from(creators),
    db.select().from(creatorProfiles),
    db.select().from(mediaKits),
    db.select().from(brandRecapDrafts),
    db.select().from(approvalEmails),
    db.select().from(usageRights),
    db.select().from(livePosts),
    db.select().from(brandCampaignReports),
    db.select().from(campaignAllocations),
    db.select().from(campaigns),
    db.select().from(brandCrmEntries),
  ]);
  return {
    dealRows,
    creatorsById: new Map(creatorRows.map((creator) => [creator.id, creator])),
    profilesById: new Map(profileRows.map((profile) => [profile.creatorId, profile])),
    kitsById: new Map(kitRows.map((kit) => [kit.creatorId, kit])),
    draftRows,
    approvalRows,
    rightsByDeal: new Map(rightRows.map((right) => [right.dealId, right])),
    postsByDeal: postRows.reduce((map, post) => {
      const list = map.get(post.dealId) ?? [];
      list.push(post);
      map.set(post.dealId, list);
      return map;
    }, new Map<string, typeof postRows>()),
    reportsByDeal: new Map(reportRows.map((report) => [report.dealId, report])),
    allocations: new Map(allocationRows.map((row) => [row.id, row])),
    campaigns: new Map(campaignRows.map((row) => [row.id, row])),
    crmRows,
  };
}

async function brandEmail(
  db: PortalDb,
  deal: { brand: string; contact: string | null },
  crmRows: { brandKey: string; contactEmail: string | null }[],
) {
  const direct = emailIn(deal.contact);
  if (direct) return direct;
  const key = brandKey(deal.brand);
  for (const row of crmRows) {
    if (row.brandKey !== key) continue;
    const email = emailIn(row.contactEmail);
    if (email) return email;
  }
  const fresh = await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.brandKey, key));
  for (const row of fresh) {
    const email = emailIn(row.contactEmail);
    if (email) return email;
  }
  return null;
}

type Loaded = Awaited<ReturnType<typeof loadRecapTables>>;

function seenKeys(loaded: Loaded) {
  const seen = new Set(loaded.draftRows.map((row) => `${row.dealId}:${row.milestone}`));
  for (const approval of loaded.approvalRows) {
    if (approval.gate !== "brand_recap") continue;
    const milestone = milestoneFromNote(approval.attachmentNote);
    if (milestone) seen.add(`${approval.dealId}:${milestone}`);
  }
  return seen;
}

function factsFor(deal: DealRow, goLiveOn: string, milestone: RecapMilestone, loaded: Loaded) {
  const creator = loaded.creatorsById.get(deal.creatorId);
  const allocation = deal.offerAllocationId ? loaded.allocations.get(deal.offerAllocationId) : undefined;
  const campaign = allocation ? loaded.campaigns.get(allocation.campaignId) : undefined;
  const ownDeliverables = parseStringList(deal.deliverablesJson);
  const deliverables = ownDeliverables.length ? ownDeliverables : parseStringList(campaign?.deliverablesJson);
  const report = loaded.reportsByDeal.get(deal.id);
  const right = loaded.rightsByDeal.get(deal.id);
  const ends = right?.endsOn?.trim() ?? "";
  return {
    brand: deal.brand,
    creatorName: creatorFacingName(creator, loaded.profilesById.get(deal.creatorId), loaded.kitsById.get(deal.creatorId)),
    milestone,
    goLiveOn,
    deliverables,
    contentLinks: linksFor(loaded.postsByDeal.get(deal.id) ?? [], report),
    metrics: metricsFor(report),
    usageEndsOn: isCalendarDay(ends) ? ends : null,
  };
}

/**
 * Writes one pending approval per deal per milestone.
 * A second run for the same deal and milestone does not add another draft.
 * Pending drafts are not sendable.
 */
export async function queueBrandRecapDrafts(db: PortalDb, today: string) {
  if (!isCalendarDay(today)) return { created: 0, skipped: 0 };
  const loaded = await loadRecapTables(db);
  const seen = seenKeys(loaded);
  let created = 0;
  let skipped = 0;
  for (const deal of loaded.dealRows) {
    const goLiveOn = goLiveFor(deal, loaded.allocations, loaded.campaigns);
    if (!goLiveOn) {
      skipped += 1;
      continue;
    }
    for (const milestone of RECAP_MILESTONES) {
      if (!isRecapDue(goLiveOn, today, milestone)) {
        skipped += 1;
        continue;
      }
      const key = `${deal.id}:${milestone}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      const to = await brandEmail(db, deal, loaded.crmRows);
      if (!to) {
        skipped += 1;
        continue;
      }
      const token = crypto.randomUUID().replace(/-/g, "");
      const facts = factsFor(deal, goLiveOn, milestone, loaded);
      const inquireUrl = publicAbsoluteUrl(recapInquirePath(facts.brand));
      const shareUrl = publicAbsoluteUrl(`/brand-recap/${token}`);
      const copy = composeBrandRecap({ ...facts, inquireUrl, shareUrl });
      if (recapCopyLeaks(copy.subject, copy.body)) {
        skipped += 1;
        continue;
      }
      const approval = await createApprovalEmail(db, {
        dealId: deal.id,
        gate: "brand_recap",
        to,
        subject: copy.subject,
        body: copy.body,
        attachmentNote: recapWindowNote(milestone, goLiveOn),
      }, { email: "portal", role: "bot" });
      if (!approval.ok || approval.status !== "pending") {
        skipped += 1;
        continue;
      }
      try {
        await db.insert(brandRecapDrafts).values({
          id: crypto.randomUUID(),
          dealId: deal.id,
          milestone: String(milestone),
          goLiveOn,
          approvalId: approval.id,
          token,
          createdAt: nowIso(),
        });
      } catch {
        skipped += 1;
        seen.add(key);
        continue;
      }
      seen.add(key);
      created += 1;
    }
  }
  return { created, skipped };
}

function statusLabel(approvalStatus: string | null, hasEmail: boolean, leaks: boolean) {
  if (approvalStatus === "pending") return "Draft waiting in Approvals";
  if (approvalStatus === "approved") return "Approved, waiting to be sent";
  if (approvalStatus === "rejected") return "Not sending";
  if (approvalStatus === "sent") return "Sent";
  if (!hasEmail) return "Add a brand email before this draft can be queued.";
  if (leaks) return "This recap is held so private deal terms stay off the brand copy.";
  return "Due";
}

/** Owner list of recaps whose 7-day or 30-day mark has arrived. */
export async function listDueBrandRecaps(db: PortalDb, viewer: Viewer, today: string): Promise<DueBrandRecap[]> {
  if (!isOwner(viewer) || !isCalendarDay(today)) return [];
  const loaded = await loadRecapTables(db);
  const draftsByKey = new Map(loaded.draftRows.map((row) => [`${row.dealId}:${row.milestone}`, row]));
  const approvalsById = new Map(loaded.approvalRows.map((row) => [row.id, row]));
  const rows: DueBrandRecap[] = [];
  for (const deal of loaded.dealRows) {
    const goLiveOn = goLiveFor(deal, loaded.allocations, loaded.campaigns);
    if (!goLiveOn) continue;
    for (const milestone of RECAP_MILESTONES) {
      if (!isRecapDue(goLiveOn, today, milestone)) continue;
      const facts = factsFor(deal, goLiveOn, milestone, loaded);
      const token = crypto.randomUUID().replace(/-/g, "");
      const inquireUrl = publicAbsoluteUrl(recapInquirePath(facts.brand));
      const shareUrl = publicAbsoluteUrl(`/brand-recap/${token}`);
      const copy = composeBrandRecap({ ...facts, inquireUrl, shareUrl });
      const leaks = recapCopyLeaks(copy.subject, copy.body);
      const draft = draftsByKey.get(`${deal.id}:${milestone}`);
      const approval = draft ? approvalsById.get(draft.approvalId) : undefined;
      const to = await brandEmail(db, deal, loaded.crmRows);
      const dueOn = recapDueOn(goLiveOn, milestone) ?? goLiveOn;
      rows.push({
        dealId: deal.id,
        brand: facts.brand,
        creatorName: facts.creatorName,
        milestone,
        milestoneLabel: recapMilestoneLabel(milestone),
        goLiveOn,
        dueOn,
        statusLabel: statusLabel(approval?.status ?? null, Boolean(to), leaks),
        href: draft ? withBasePath(`/brand-recap/${draft.token}`) : null,
      });
    }
  }
  return rows.sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.brand.localeCompare(right.brand) || left.milestone - right.milestone);
}

export async function publicBrandRecap(db: PortalDb, token: string): Promise<BrandRecapCopy | null> {
  const rows = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.token, token));
  const draft = rows[0];
  if (!draft || (draft.milestone !== "7" && draft.milestone !== "30")) return null;
  const milestone = Number(draft.milestone) as RecapMilestone;
  const loaded = await loadRecapTables(db);
  const deal = loaded.dealRows.find((row) => row.id === draft.dealId);
  if (!deal) return null;
  const facts = factsFor(deal, draft.goLiveOn, milestone, loaded);
  const inquireUrl = publicAbsoluteUrl(recapInquirePath(facts.brand));
  const shareUrl = publicAbsoluteUrl(`/brand-recap/${draft.token}`);
  const copy = composeBrandRecap({ ...facts, inquireUrl, shareUrl });
  if (recapCopyLeaks(copy.subject, copy.body)) return null;
  return copy;
}
