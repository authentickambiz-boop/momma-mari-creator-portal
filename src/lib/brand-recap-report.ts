/**
 * Pure helpers for the brand recap report.
 * Measured numbers stay labelled by source. Empty and sample figures stay out.
 * Pay, floors, and the fee split never belong on a brand-facing row.
 */

export const RECAP_GOAL_TYPES = [
  { id: "views", label: "Views" },
  { id: "clicks", label: "Clicks" },
  { id: "sales", label: "Sales" },
  { id: "ugc_assets", label: "UGC assets" },
] as const;

export const RECAP_SNAPSHOT_WINDOWS = [
  { id: "48h", label: "48 hours" },
  { id: "7d", label: "7 days" },
] as const;

export const RECAP_SOURCES = [
  { id: "withjuly_platform", label: "WithJuly / platform" },
  { id: "link_check", label: "Link check" },
  { id: "creator_submitted", label: "Creator-submitted" },
] as const;

export const RECAP_SNAPSHOT_METRICS = [
  { id: "views", label: "Views" },
  { id: "engagement", label: "Engagement rate" },
  { id: "clicks", label: "Clicks" },
  { id: "codes", label: "Codes" },
  { id: "comments", label: "Comments" },
  { id: "sales", label: "Sales" },
  { id: "ugc_assets", label: "UGC assets" },
] as const;

export const RECAP_PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "pinterest", label: "Pinterest" },
  { id: "x", label: "X" },
] as const;

export type RecapGoalType = (typeof RECAP_GOAL_TYPES)[number]["id"];
export type RecapSnapshotWindow = (typeof RECAP_SNAPSHOT_WINDOWS)[number]["id"];
export type RecapSource = (typeof RECAP_SOURCES)[number]["id"];
export type RecapSnapshotMetric = (typeof RECAP_SNAPSHOT_METRICS)[number]["id"];

export type RecapSnapshotView = {
  window: RecapSnapshotWindow;
  windowLabel: string;
  metric: RecapSnapshotMetric;
  metricLabel: string;
  value: string;
  source: RecapSource;
  sourceLabel: string;
  postId: string | null;
  postLabel: string | null;
};

export type RecapGoalView = {
  type: RecapGoalType;
  label: string;
  target: string;
  result: string | null;
  resultWindow: string | null;
  resultSource: string | null;
  resultStatus: "reported" | "pending";
};

export type RecapPostInput = {
  url: string;
  platform: string;
  postedOn: string | null;
  deliverableLabel: string | null;
};

export type RecapDeliverableLog = {
  label: string;
  status: "posted" | "pending";
  url: string | null;
  platform: string | null;
  platformLabel: string | null;
  postedOn: string | null;
};

export type RecapMetricCard = {
  label: string;
  value: string;
  detail: string | null;
  sourceLabel: string | null;
  windowLabel: string | null;
  postLabel: string | null;
  kind: "snapshot" | "metric";
};

const PRIVATE_LINE = /\$|\bminimum\b|\bfloor\b|fee split|agency fee|\b80\s*\/\s*20\b|\bsplit\b|deal rule/i;
const FAKE_LINE = /\b(example|placeholder|sample|fake|lorem|tbd|xxx|demo)\b/i;
const EXTRA_DENY = /rateCents|rateLabel|ratePaid|minRates|creatorPayout|creator pay|amountOwed|splitPercent|renewalFee|80\/20|20%|payout/i;

export function isPrivateRecapText(value: string) {
  return PRIVATE_LINE.test(value);
}

export function looksLikeSample(value: string) {
  return FAKE_LINE.test(value) || /\bn\/a\b/i.test(value);
}

/** A measured figure the owner actually entered. Sample words and blank lines are not figures. */
export function isRealReportedValue(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text || text.length > 40 || /[\r\n]/.test(text)) return false;
  if (text.toLowerCase() === "not reported yet") return false;
  if (looksLikeSample(text) || isPrivateRecapText(text)) return false;
  return true;
}

export function goalTypeId(value: string | null | undefined): RecapGoalType | null {
  const id = value?.trim() ?? "";
  return RECAP_GOAL_TYPES.some((goal) => goal.id === id) ? id as RecapGoalType : null;
}

export function snapshotWindowId(value: string | null | undefined): RecapSnapshotWindow | null {
  const text = value?.trim().toLowerCase() ?? "";
  if (text === "48h" || text === "48 hours" || text === "48 hour") return "48h";
  if (text === "7d" || text === "7 days" || text === "7 day") return "7d";
  return null;
}

export function snapshotMetricId(value: string | null | undefined): RecapSnapshotMetric | null {
  const text = value?.trim().toLowerCase() ?? "";
  const found = RECAP_SNAPSHOT_METRICS.find((metric) => metric.id === text || metric.label.toLowerCase() === text);
  return found?.id ?? null;
}

export function recapSourceId(value: string | null | undefined): RecapSource | null {
  const text = value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  if (text === "withjuly_platform" || text === "withjuly/platform" || text === "withjuly / platform" || text === "withjuly" || text === "platform") {
    return "withjuly_platform";
  }
  if (text === "link_check" || text === "link check") return "link_check";
  if (text === "creator_submitted" || text === "creator-submitted" || text === "creator submitted" || text === "creator") {
    return "creator_submitted";
  }
  return null;
}

export function goalTypeLabel(id: string) {
  return RECAP_GOAL_TYPES.find((goal) => goal.id === id)?.label ?? null;
}

export function snapshotWindowLabel(id: string) {
  return RECAP_SNAPSHOT_WINDOWS.find((window) => window.id === id)?.label ?? null;
}

export function snapshotMetricLabel(id: string) {
  return RECAP_SNAPSHOT_METRICS.find((metric) => metric.id === id)?.label ?? null;
}

export function recapSourceLabel(id: string) {
  return RECAP_SOURCES.find((source) => source.id === id)?.label ?? null;
}

export function platformId(value: string | null | undefined) {
  const text = value?.trim().toLowerCase() ?? "";
  return RECAP_PLATFORMS.some((platform) => platform.id === text) ? text : null;
}

export function platformLabel(value: string | null | undefined) {
  const id = platformId(value);
  if (id) return RECAP_PLATFORMS.find((platform) => platform.id === id)?.label ?? id;
  const raw = value?.trim() ?? "";
  if (!raw || raw.length > 40 || isPrivateRecapText(raw) || looksLikeSample(raw)) return null;
  return raw;
}

/** A whole number the owner typed at kickoff, kept without commas. */
export function parseGoalTarget(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text || looksLikeSample(text) || isPrivateRecapText(text)) return null;
  const digits = text.replace(/,/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return String(parsed);
}

export function formatGoalTarget(canonical: string) {
  if (!/^\d+$/.test(canonical)) return canonical;
  return Number(canonical).toLocaleString("en-US");
}

export function parseKickoffGoal(type: string | null | undefined, target: string | null | undefined):
  | { ok: true; set: boolean; goalType: string | null; goalTarget: string | null }
  | { ok: false; error: string } {
  if (type === undefined && target === undefined) {
    return { ok: true, set: false, goalType: null, goalTarget: null };
  }
  const goalType = (type ?? "").trim();
  const goalTarget = (target ?? "").trim();
  if (!goalType && !goalTarget) return { ok: true, set: true, goalType: null, goalTarget: null };
  if (!goalTypeId(goalType) || !goalTarget) return { ok: false, error: "Add both the goal and the target number." };
  const parsed = parseGoalTarget(goalTarget);
  if (!parsed) return { ok: false, error: "Enter the target as a number, like 100000." };
  return { ok: true, set: true, goalType, goalTarget: parsed };
}

function sameDeliverable(left: string | null | undefined, right: string | null | undefined) {
  const a = left?.trim().toLowerCase() ?? "";
  const b = right?.trim().toLowerCase() ?? "";
  return Boolean(a) && a === b;
}

function httpUrl(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return /^https?:\/\/\S+$/i.test(text) ? text : null;
}

/** Contract lines with a matching post are posted. Lines with no post stay pending. */
export function buildDeliverableLog(lines: string[], posts: RecapPostInput[]): RecapDeliverableLog[] {
  const rows: RecapDeliverableLog[] = [];
  for (const line of lines) {
    const label = line.trim();
    if (!label) continue;
    const matches = posts.filter((post) => sameDeliverable(post.deliverableLabel, label) && httpUrl(post.url));
    if (matches.length === 0) {
      rows.push({
        label,
        status: "pending",
        url: null,
        platform: null,
        platformLabel: null,
        postedOn: null,
      });
      continue;
    }
    for (const post of matches) {
      const postedOn = post.postedOn && /^\d{4}-\d{2}-\d{2}$/.test(post.postedOn) ? post.postedOn : null;
      rows.push({
        label,
        status: "posted",
        url: httpUrl(post.url),
        platform: post.platform,
        platformLabel: platformLabel(post.platform),
        postedOn,
      });
    }
  }
  return rows;
}

function windowRank(window: RecapSnapshotWindow) {
  return window === "7d" ? 2 : 1;
}

/** The later sourced snapshot is the result. Several posts are not added together. */
export function recapGoalView(
  type: string | null | undefined,
  target: string | null | undefined,
  snapshots: RecapSnapshotView[],
): RecapGoalView | null {
  const goalType = goalTypeId(type);
  const canonical = parseGoalTarget(target);
  if (!goalType || !canonical) return null;
  const label = goalTypeLabel(goalType);
  if (!label) return null;
  const fitting = snapshots.filter((snapshot) => snapshot.metric === goalType && isRealReportedValue(snapshot.value));
  const windows: RecapSnapshotWindow[] = ["7d", "48h"];
  for (const window of windows) {
    const inWindow = fitting.filter((snapshot) => snapshot.window === window);
    const dealLevel = inWindow.filter((snapshot) => !snapshot.postId);
    const chosen = dealLevel.length === 1 ? dealLevel[0] : dealLevel.length === 0 && inWindow.length === 1 ? inWindow[0] : null;
    if (!chosen) continue;
    return {
      type: goalType,
      label,
      target: formatGoalTarget(canonical),
      result: chosen.value,
      resultWindow: chosen.windowLabel,
      resultSource: chosen.sourceLabel,
      resultStatus: "reported",
    };
  }
  return {
    type: goalType,
    label,
    target: formatGoalTarget(canonical),
    result: null,
    resultWindow: null,
    resultSource: null,
    resultStatus: "pending",
  };
}

export function orderedSnapshots(snapshots: RecapSnapshotView[]) {
  return [...snapshots].sort((left, right) => windowRank(left.window) - windowRank(right.window)
    || left.metric.localeCompare(right.metric)
    || (left.postLabel ?? "").localeCompare(right.postLabel ?? ""));
}

export function toSnapshotView(input: {
  window: string;
  metric: string;
  value: string;
  source: string;
  postId?: string | null;
  postLabel?: string | null;
}): RecapSnapshotView | null {
  const window = snapshotWindowId(input.window);
  const metric = snapshotMetricId(input.metric);
  const source = recapSourceId(input.source);
  const value = input.value.trim();
  if (!window || !metric || !source || !isRealReportedValue(value)) return null;
  const windowLabel = snapshotWindowLabel(window);
  const metricLabel = snapshotMetricLabel(metric);
  const sourceLabel = recapSourceLabel(source);
  if (!windowLabel || !metricLabel || !sourceLabel) return null;
  return {
    window,
    windowLabel,
    metric,
    metricLabel,
    value,
    source,
    sourceLabel,
    postId: input.postId ?? null,
    postLabel: input.postLabel ?? null,
  };
}

export function visibleRecapMetrics<T extends { label: string; value: string }>(metrics: T[]) {
  return metrics.filter((metric) => isRealReportedValue(metric.value) && !looksLikeSample(metric.label));
}

/** Cards for figures we actually have. A sourced snapshot stands in for the same unsourced line. */
export function recapMetricCards(input: {
  metrics: { label: string; value: string }[];
  snapshots: RecapSnapshotView[];
}): RecapMetricCard[] {
  const cards: RecapMetricCard[] = orderedSnapshots(input.snapshots)
    .filter((snapshot) => isRealReportedValue(snapshot.value))
    .map((snapshot) => ({
      label: snapshot.metricLabel,
      value: snapshot.value,
      detail: [snapshot.windowLabel, snapshot.sourceLabel, snapshot.postLabel].filter(Boolean).join(" · ") || null,
      sourceLabel: snapshot.sourceLabel,
      windowLabel: snapshot.windowLabel,
      postLabel: snapshot.postLabel,
      kind: "snapshot" as const,
    }));
  const covered = new Set(cards.map((card) => card.label));
  for (const metric of visibleRecapMetrics(input.metrics)) {
    if (covered.has(metric.label)) continue;
    cards.push({
      label: metric.label,
      value: metric.value,
      detail: null,
      sourceLabel: null,
      windowLabel: null,
      postLabel: null,
      kind: "metric",
    });
  }
  return cards.filter((card) => isRealReportedValue(card.value) && !looksLikeSample(card.label));
}

export type SnapshotImportRow = {
  window: RecapSnapshotWindow;
  metric: RecapSnapshotMetric;
  value: string;
  source: RecapSource;
};

/** One snapshot per line: window, metric, value, source. */
export function parseSnapshotImport(text: string): { ok: true; rows: SnapshotImportRow[] } | { ok: false; error: string } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  if (lines.length === 0) return { ok: false, error: "Nothing in that import was saved. Check each line." };
  const rows: SnapshotImportRow[] = [];
  for (const line of lines) {
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length !== 4) return { ok: false, error: "Nothing in that import was saved. Check each line." };
    const window = snapshotWindowId(parts[0]);
    const metric = snapshotMetricId(parts[1]);
    const source = recapSourceId(parts[3]);
    const value = parts[2]?.trim() ?? "";
    if (!window || !metric || !source || !isRealReportedValue(value)) {
      return { ok: false, error: "Nothing in that import was saved. Check each line." };
    }
    rows.push({ window, metric, value, source });
  }
  const unique = new Map<string, SnapshotImportRow>();
  for (const row of rows) unique.set(`${row.window}:${row.metric}`, row);
  return { ok: true, rows: [...unique.values()] };
}

export type RecapCsvInput = {
  brand: string;
  creatorName: string;
  milestone: number;
  goLiveOn: string;
  metrics: { label: string; value: string }[];
  usageEndsOn: string | null;
  goal: RecapGoalView | null;
  deliverableLog: RecapDeliverableLog[];
  snapshots: RecapSnapshotView[];
  nextCampaignNote: string | null;
};

function csvCell(value: string) {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function rowIsSafe(cells: string[]) {
  return cells.every((cell) => !isPrivateRecapText(cell) && !EXTRA_DENY.test(cell) && !looksLikeSample(cell));
}

function milestoneLabel(days: number) {
  if (days === 30) return "30-day recap";
  if (days === 7) return "7-day recap";
  return "";
}

/** Allowlisted columns only. A row that mentions pay or a sample figure is left out. */
export function brandRecapCsv(input: RecapCsvInput) {
  const header = ["section", "label", "value", "source", "status", "platform", "posted_on", "url", "window"];
  const lines = [header.join(",")];
  const push = (cells: string[]) => {
    if (!rowIsSafe(cells)) return;
    lines.push(cells.map(csvCell).join(","));
  };
  const recapLabel = milestoneLabel(input.milestone);
  push(["recap", "Brand", input.brand.trim(), "", "", "", "", "", ""]);
  push(["recap", "Creator", input.creatorName.trim(), "", "", "", "", "", ""]);
  if (recapLabel) push(["recap", "Recap", recapLabel, "", "", "", "", "", ""]);
  if (input.goLiveOn.trim()) push(["recap", "Go-live", input.goLiveOn.trim(), "", "", "", "", "", ""]);
  if (input.goal) {
    push(["goal", `${input.goal.label} target`, input.goal.target, "", "", "", "", "", ""]);
    if (input.goal.resultStatus === "reported" && input.goal.result && isRealReportedValue(input.goal.result)) {
      push(["goal", `${input.goal.label} result`, input.goal.result, input.goal.resultSource ?? "", "reported", "", "", "", input.goal.resultWindow ?? ""]);
    } else {
      push(["goal", `${input.goal.label} result`, "", "", "Pending", "", "", "", ""]);
    }
  }
  for (const row of input.deliverableLog) {
    if (row.status === "pending") {
      push(["deliverable", row.label, "", "", "Pending", "", "", "", ""]);
      continue;
    }
    push(["deliverable", row.label, "", "", "Posted", row.platformLabel ?? "", row.postedOn ?? "", row.url ?? "", ""]);
  }
  for (const card of recapMetricCards(input)) {
    push([
      card.kind,
      card.label,
      card.value,
      card.sourceLabel ?? "",
      "",
      card.postLabel ?? "",
      "",
      "",
      card.windowLabel ?? "",
    ]);
  }
  if (input.usageEndsOn && /^\d{4}-\d{2}-\d{2}$/.test(input.usageEndsOn)) {
    push(["usage", "Usage rights end date", input.usageEndsOn, "", "", "", "", "", ""]);
  }
  const note = input.nextCampaignNote?.trim() ?? "";
  if (note && !isPrivateRecapText(note) && !looksLikeSample(note)) {
    push(["next", "Next campaign", note, "", "", "", "", "", ""]);
  }
  return `${lines.join("\n")}\n`;
}
