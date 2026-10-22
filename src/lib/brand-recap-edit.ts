import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import {
  approvalEmails,
  brandCampaignReports,
  brandRecapDrafts,
  brandRecapGoals,
  brandRecapSnapshots,
  campaignAllocations,
  campaigns,
  creators,
  deals,
  livePosts,
} from "@/db/schema";
import { isOwner } from "./authz";
import { addCalendarDays, publicBrandRecap, publicRecapLine, recapGoLive, recapMilestoneLabel, type RecapMilestone } from "./brand-recap";
import {
  isPrivateRecapText,
  isRealReportedValue,
  parseKickoffGoal,
  parseSnapshotImport,
  platformId,
  platformLabel,
  recapSourceId,
  snapshotMetricId,
  snapshotWindowId,
  toSnapshotView,
  type RecapSnapshotView,
  type RecapSource,
  type RecapSnapshotMetric,
  type RecapSnapshotWindow,
} from "./brand-recap-report";
import { nowIso, parseJson, withBasePath } from "./format";
import type { Viewer } from "./types";

type Result = { ok: true } | { ok: false; error: string };

function realDay(value: string) {
  return addCalendarDays(value, 0) === value;
}

async function requireDeal(db: PortalDb, viewer: Viewer, dealId: string) {
  if (!isOwner(viewer)) return { ok: false as const, error: "Only the owner can edit a recap." };
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  const deal = rows[0];
  if (!deal) return { ok: false as const, error: "That deal is not on the board." };
  return { ok: true as const, deal };
}

async function contractLines(db: PortalDb, deal: typeof deals.$inferSelect) {
  const own = parseJson<unknown>(deal.deliverablesJson, []);
  const ownLines = Array.isArray(own) ? own.filter((item): item is string => typeof item === "string") : [];
  let lines = ownLines;
  if (lines.length === 0 && deal.offerAllocationId) {
    const allocations = await db.select().from(campaignAllocations).where(eq(campaignAllocations.id, deal.offerAllocationId));
    const allocation = allocations[0];
    if (allocation) {
      const campaignRows = await db.select().from(campaigns).where(eq(campaigns.id, allocation.campaignId));
      const parsed = parseJson<unknown>(campaignRows[0]?.deliverablesJson, []);
      if (Array.isArray(parsed)) lines = parsed.filter((item): item is string => typeof item === "string");
    }
  }
  return lines.map((line) => publicRecapLine(line)).filter((line): line is string => Boolean(line));
}

/** Rewrites a pending approval draft so the copy matches the shared page. It does not send. */
async function refreshPendingCopies(db: PortalDb, dealId: string) {
  const drafts = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, dealId));
  for (const draft of drafts) {
    const copy = await publicBrandRecap(db, draft.token);
    if (!copy) continue;
    const approvals = await db.select().from(approvalEmails).where(eq(approvalEmails.id, draft.approvalId));
    const approval = approvals[0];
    if (!approval || approval.status !== "pending" || approval.sentAt) continue;
    await db.update(approvalEmails).set({
      subject: copy.subject,
      body: copy.body,
      updatedAt: nowIso(),
    }).where(eq(approvalEmails.id, approval.id));
  }
}

export async function saveDealRecapGoal(db: PortalDb, viewer: Viewer, dealId: string, goalType: string, goalTarget: string): Promise<Result> {
  const deal = await requireDeal(db, viewer, dealId);
  if (!deal.ok) return deal;
  const parsed = parseKickoffGoal(goalType, goalTarget);
  if (!parsed.ok) return parsed;
  if (!parsed.goalType || !parsed.goalTarget) {
    await db.delete(brandRecapGoals).where(eq(brandRecapGoals.dealId, deal.deal.id));
  } else {
    await db.insert(brandRecapGoals).values({
      dealId: deal.deal.id,
      goalType: parsed.goalType,
      targetValue: parsed.goalTarget,
      updatedAt: nowIso(),
    }).onConflictDoUpdate({
      target: brandRecapGoals.dealId,
      set: { goalType: parsed.goalType, targetValue: parsed.goalTarget, updatedAt: nowIso() },
    });
  }
  await refreshPendingCopies(db, deal.deal.id);
  return { ok: true };
}

export async function logRecapPost(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; url: string; platform: string; postedOn: string; deliverable: string },
): Promise<Result> {
  const deal = await requireDeal(db, viewer, input.dealId);
  if (!deal.ok) return deal;
  const platform = platformId(input.platform);
  if (!platform) return { ok: false, error: "Choose a platform from the list." };
  const url = input.url.trim();
  if (!publicRecapLine(url) || !/^https?:\/\/\S+$/i.test(url)) {
    return { ok: false, error: "The post link has to start with http:// or https://." };
  }
  const postedOn = input.postedOn.trim();
  if (!realDay(postedOn)) return { ok: false, error: "Use a posted date like 2026-10-14." };
  const lines = await contractLines(db, deal.deal);
  const deliverable = lines.find((line) => line.toLowerCase() === input.deliverable.trim().toLowerCase());
  if (!deliverable) return { ok: false, error: "Choose one of the contracted deliverables." };
  const timestamp = nowIso();
  const existing = await db.select().from(livePosts).where(eq(livePosts.dealId, deal.deal.id));
  const match = existing.find((post) => post.url === url);
  if (match) {
    await db.update(livePosts).set({
      platform,
      postedOn,
      deliverableLabel: deliverable,
      updatedAt: timestamp,
    }).where(eq(livePosts.id, match.id));
  } else {
    await db.insert(livePosts).values({
      id: crypto.randomUUID(),
      dealId: deal.deal.id,
      platform,
      url,
      meetsBrief: null,
      confirmedAt: null,
      confirmedBy: null,
      postedOn,
      deliverableLabel: deliverable,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  await refreshPendingCopies(db, deal.deal.id);
  return { ok: true };
}

async function writeSnapshot(
  db: PortalDb,
  dealId: string,
  input: { window: RecapSnapshotWindow; metric: RecapSnapshotMetric; value: string; source: RecapSource; postId: string | null },
) {
  const existing = await db.select().from(brandRecapSnapshots).where(eq(brandRecapSnapshots.dealId, dealId));
  const match = existing.find((row) => row.window === input.window && row.metric === input.metric && (row.postId ?? null) === input.postId);
  if (match) {
    await db.update(brandRecapSnapshots).set({
      value: input.value,
      source: input.source,
    }).where(eq(brandRecapSnapshots.id, match.id));
    return;
  }
  await db.insert(brandRecapSnapshots).values({
    id: crypto.randomUUID(),
    dealId,
    postId: input.postId,
    window: input.window,
    metric: input.metric,
    value: input.value,
    source: input.source,
    createdAt: nowIso(),
  });
}

export async function saveRecapSnapshot(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; window: string; metric: string; value: string; source: string; postId?: string | null },
): Promise<Result> {
  const deal = await requireDeal(db, viewer, input.dealId);
  if (!deal.ok) return deal;
  const view = toSnapshotView({
    window: input.window,
    metric: input.metric,
    value: input.value,
    source: input.source,
    postId: input.postId ?? null,
  });
  if (!view) {
    const value = input.value.trim();
    if (value && isPrivateRecapText(value)) return { ok: false, error: "That text mentions private deal terms. It was not saved." };
    if (value && !isRealReportedValue(value)) return { ok: false, error: "That figure looks like a sample. Enter the recorded one." };
    if (snapshotWindowId(input.window) && snapshotMetricId(input.metric) && !recapSourceId(input.source)) {
      return { ok: false, error: "Choose WithJuly / platform, link check, or creator-submitted." };
    }
    return { ok: false, error: "Add the window, the metric, the number, and where it came from." };
  }
  let postId: string | null = null;
  if (input.postId?.trim()) {
    const posts = await db.select().from(livePosts).where(eq(livePosts.dealId, deal.deal.id));
    const post = posts.find((row) => row.id === input.postId);
    if (!post) return { ok: false, error: "Add the window, the metric, the number, and where it came from." };
    postId = post.id;
  }
  await writeSnapshot(db, deal.deal.id, {
    window: view.window,
    metric: view.metric,
    value: view.value,
    source: view.source,
    postId,
  });
  await refreshPendingCopies(db, deal.deal.id);
  return { ok: true };
}

export async function importRecapSnapshots(db: PortalDb, viewer: Viewer, dealId: string, text: string): Promise<Result> {
  const deal = await requireDeal(db, viewer, dealId);
  if (!deal.ok) return deal;
  const parsed = parseSnapshotImport(text);
  if (!parsed.ok) return parsed;
  for (const row of parsed.rows) {
    await writeSnapshot(db, deal.deal.id, { ...row, postId: null });
  }
  await refreshPendingCopies(db, deal.deal.id);
  return { ok: true };
}

export async function importReportSnapshots(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; window: string; source: string },
): Promise<Result> {
  const deal = await requireDeal(db, viewer, input.dealId);
  if (!deal.ok) return deal;
  const window = snapshotWindowId(input.window);
  const source = recapSourceId(input.source);
  if (!window) return { ok: false, error: "Add the window, the metric, the number, and where it came from." };
  if (!source) return { ok: false, error: "Choose WithJuly / platform, link check, or creator-submitted." };
  const reports = await db.select().from(brandCampaignReports).where(eq(brandCampaignReports.dealId, deal.deal.id));
  const report = reports[0];
  if (!report) return { ok: false, error: "Nothing in that import was saved. Check each line." };
  const pairs: [RecapSnapshotMetric, string | null][] = [
    ["views", report.viewsLabel],
    ["engagement", report.engagementLabel],
    ["clicks", report.clicksLabel],
    ["codes", report.codesLabel],
    ["comments", report.commentsLabel],
  ];
  let wrote = 0;
  for (const [metric, value] of pairs) {
    const text = value?.trim() ?? "";
    if (!snapshotMetricId(metric) || !isRealReportedValue(text)) continue;
    await writeSnapshot(db, deal.deal.id, {
      window,
      metric,
      value: text,
      source,
      postId: null,
    });
    wrote += 1;
  }
  if (wrote === 0) return { ok: false, error: "Nothing in that import was saved. Check each line." };
  await refreshPendingCopies(db, deal.deal.id);
  return { ok: true };
}

export async function saveNextCampaignNote(
  db: PortalDb,
  viewer: Viewer,
  input: { dealId: string; milestone: string; note: string },
): Promise<Result> {
  const deal = await requireDeal(db, viewer, input.dealId);
  if (!deal.ok) return deal;
  if (input.milestone !== "7" && input.milestone !== "30") return { ok: false, error: "That recap draft is not on the list yet." };
  const drafts = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, deal.deal.id));
  const draft = drafts.find((row) => row.milestone === input.milestone);
  if (!draft) return { ok: false, error: "That recap draft is not on the list yet." };
  const note = input.note.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (note.length > 500) return { ok: false, error: "Keep the next campaign note under 500 characters." };
  if (note && (isPrivateRecapText(note) || !publicRecapLine(note))) {
    return { ok: false, error: "That text mentions private deal terms. It was not saved." };
  }
  await db.update(brandRecapDrafts).set({ nextCampaignNote: note || null }).where(eq(brandRecapDrafts.id, draft.id));
  await refreshPendingCopies(db, deal.deal.id);
  return { ok: true };
}

export type RecapEditorData = {
  dealId: string;
  brand: string;
  creatorName: string;
  goLiveOn: string | null;
  goalType: string;
  goalTarget: string;
  goalFromCampaign: boolean;
  contractLines: string[];
  posts: {
    id: string;
    platform: string;
    platformLabel: string | null;
    url: string;
    postedOn: string | null;
    deliverableLabel: string | null;
  }[];
  snapshots: RecapSnapshotView[];
  drafts: {
    milestone: RecapMilestone;
    milestoneLabel: string;
    href: string;
    csvHref: string;
    note: string;
  }[];
  savedMetrics: { label: string; value: string }[];
};

export async function recapEditor(db: PortalDb, viewer: Viewer, dealId: string): Promise<{ ok: true; editor: RecapEditorData } | { ok: false; error: string }> {
  const loaded = await requireDeal(db, viewer, dealId);
  if (!loaded.ok) return loaded;
  const deal = loaded.deal;
  const people = await db.select({ name: creators.name }).from(creators).where(eq(creators.id, deal.creatorId));
  let allocation = null;
  let campaign = null;
  if (deal.offerAllocationId) {
    const allocations = await db.select().from(campaignAllocations).where(eq(campaignAllocations.id, deal.offerAllocationId));
    allocation = allocations[0] ?? null;
    if (allocation) {
      const campaignRows = await db.select().from(campaigns).where(eq(campaigns.id, allocation.campaignId));
      campaign = campaignRows[0] ?? null;
    }
  }
  const goalRow = (await db.select().from(brandRecapGoals).where(eq(brandRecapGoals.dealId, deal.id)))[0];
  const posts = await db.select().from(livePosts).where(eq(livePosts.dealId, deal.id));
  const snapshotRows = await db.select().from(brandRecapSnapshots).where(eq(brandRecapSnapshots.dealId, deal.id));
  const drafts = await db.select().from(brandRecapDrafts).where(eq(brandRecapDrafts.dealId, deal.id));
  const reports = await db.select().from(brandCampaignReports).where(eq(brandCampaignReports.dealId, deal.id));
  const report = reports[0];
  const savedPairs: [string, string | null][] = report ? [
    ["Views", report.viewsLabel],
    ["Engagement rate", report.engagementLabel],
    ["Clicks", report.clicksLabel],
    ["Codes", report.codesLabel],
    ["Comments", report.commentsLabel],
  ] : [];
  const allocations = new Map(allocation ? [[allocation.id, allocation]] : []);
  const campaignMap = new Map(campaign ? [[campaign.id, campaign]] : []);
  return {
    ok: true,
    editor: {
      dealId: deal.id,
      brand: deal.brand,
      creatorName: publicRecapLine(people[0]?.name ?? "") ?? "Creator",
      goLiveOn: recapGoLive(deal, allocations, campaignMap),
      goalType: goalRow?.goalType ?? campaign?.goalType ?? "",
      goalTarget: goalRow?.targetValue ?? campaign?.goalTarget ?? "",
      goalFromCampaign: !goalRow && Boolean(campaign?.goalType && campaign?.goalTarget),
      contractLines: await contractLines(db, deal),
      posts: posts.map((post) => ({
        id: post.id,
        platform: post.platform,
        platformLabel: platformLabel(post.platform),
        url: post.url,
        postedOn: post.postedOn,
        deliverableLabel: post.deliverableLabel,
      })),
      snapshots: snapshotRows.flatMap((row) => {
        const post = row.postId ? posts.find((item) => item.id === row.postId) : undefined;
        const view = toSnapshotView({
          window: row.window,
          metric: row.metric,
          value: row.value,
          source: row.source,
          postId: row.postId,
          postLabel: post ? platformLabel(post.platform) : null,
        });
        return view ? [view] : [];
      }),
      drafts: drafts.flatMap((draft) => {
        if (draft.milestone !== "7" && draft.milestone !== "30") return [];
        const milestone = Number(draft.milestone) as RecapMilestone;
        const href = withBasePath(`/brand-recap/${draft.token}`);
        return [{
          milestone,
          milestoneLabel: recapMilestoneLabel(milestone),
          href,
          csvHref: `${href}/csv`,
          note: draft.nextCampaignNote ?? "",
        }];
      }).sort((left, right) => left.milestone - right.milestone),
      savedMetrics: savedPairs.flatMap(([label, value]) => {
        const text = value?.trim() ?? "";
        return isRealReportedValue(text) ? [{ label, value: text }] : [];
      }),
    },
  };
}

export function recapSavedNote(code: string | undefined) {
  if (code === "goal" || code === "post" || code === "snapshot" || code === "import" || code === "note") {
    return "Saved. Nothing was emailed.";
  }
  return null;
}
