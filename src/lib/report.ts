import { and, eq, inArray } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { analyticsDaily, approvalEmails, creatorReportDrafts, creators, deals, payments } from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import { agencyTimeZone, formatMoney, nowIso } from "./format";
import { stageShortLabel } from "./stages";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type MonthlyReport = {
  creatorId: string;
  creatorName: string;
  month: string;
  monthLabel: string;
  earnings: {
    paidCents: number;
    paidLabel: string;
    dealsPaid: { brand: string; payoutLabel: string }[];
  };
  deals: { brand: string; stageLabel: string }[];
  growth: {
    followers: number | null;
    followerChange: number | null;
    views: number | null;
  };
  email: { subject: string; body: string };
};

export function currentMonth(now = new Date(), timeZone = agencyTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function isMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, (mon || 1) - 1, 1)),
  );
}

function inMonth(value: string | null | undefined, month: string) {
  return Boolean(value && value.slice(0, 7) === month);
}

export function reportEmail(report: Omit<MonthlyReport, "email">) {
  const paidLines = report.earnings.dealsPaid.length
    ? report.earnings.dealsPaid.map((row) => `${row.brand}: ${row.payoutLabel}`)
    : ["No cut was sent this month."];
  const dealLines = report.deals.length
    ? report.deals.map((row) => `${row.brand}: ${row.stageLabel}`)
    : ["No deals moved this month."];
  const growthLines = [
    report.growth.followers == null ? "Followers: no new numbers this month." : `Followers: ${report.growth.followers.toLocaleString("en-US")}`,
    report.growth.followerChange == null
      ? null
      : `Change: ${report.growth.followerChange >= 0 ? "+" : ""}${report.growth.followerChange.toLocaleString("en-US")}`,
    report.growth.views == null ? "Views: no new numbers this month." : `Views: ${report.growth.views.toLocaleString("en-US")}`,
  ].filter((line): line is string => Boolean(line));
  const subject = `Your ${report.monthLabel} report`;
  const body = [
    `Hi ${report.creatorName},`,
    "",
    `Here is your ${report.monthLabel} report.`,
    "",
    "Earnings",
    `Your cut sent: ${report.earnings.paidLabel}`,
    ...paidLines,
    "",
    "Deals",
    ...dealLines,
    "",
    "Growth",
    ...growthLines,
    "",
    "This note is waiting for Kamron to approve it. Nothing has been sent.",
  ].join("\n");
  return { subject, body };
}

export async function buildMonthlyReport(db: PortalDb, creatorId: string, month: string): Promise<Result<{ report: MonthlyReport }>> {
  if (!isMonthKey(month)) return { ok: false, status: 400, error: "Month has to look like 2026-10." };
  const creatorRows = await db.select().from(creators).where(eq(creators.id, creatorId));
  const creator = creatorRows[0];
  if (!creator) return { ok: false, status: 404, error: "Creator not found." };
  const dealRows = await db.select().from(deals).where(eq(deals.creatorId, creatorId));
  const visible = dealRows.filter((deal) => deal.visibleToCreator);
  const paymentRows = visible.length
    ? await db.select().from(payments).where(inArray(payments.dealId, visible.map((deal) => deal.id)))
    : [];
  const brandByDeal = new Map(visible.map((deal) => [deal.id, deal.brand]));
  const dealsPaid = paymentRows
    .map((row) => ({ ...row, brand: brandByDeal.get(row.dealId) ?? "Deal" }))
    .filter((row) => inMonth(row.paidOutDate, month) && row.creatorPayoutCents != null)
    .map((row) => ({ brand: row.brand, payoutLabel: formatMoney(row.creatorPayoutCents ?? 0), cents: row.creatorPayoutCents ?? 0 }));
  const paidCents = dealsPaid.reduce((sum, row) => sum + row.cents, 0);
  const monthDeals = visible
    .filter((deal) => inMonth(deal.updatedAt, month) || inMonth(deal.createdAt, month))
    .map((deal) => ({ brand: deal.brand, stageLabel: stageShortLabel(deal.workflowStage) }));
  const metrics = await db.select().from(analyticsDaily).where(eq(analyticsDaily.creatorId, creatorId));
  const real = metrics
    .filter((row) => !row.isExample && inMonth(row.metricDate, month))
    .slice()
    .sort((a, b) => a.metricDate.localeCompare(b.metricDate));
  const withFollowers = real.filter((row) => row.followers != null);
  const firstFollowers = withFollowers[0]?.followers ?? null;
  const lastFollowers = withFollowers.at(-1)?.followers ?? null;
  const views = real.some((row) => row.views != null) ? real.reduce((sum, row) => sum + (row.views ?? 0), 0) : null;
  const base = {
    creatorId,
    creatorName: creator.name,
    month,
    monthLabel: monthLabel(month),
    earnings: {
      paidCents,
      paidLabel: formatMoney(paidCents),
      dealsPaid: dealsPaid.map((row) => ({ brand: row.brand, payoutLabel: row.payoutLabel })),
    },
    deals: monthDeals,
    growth: {
      followers: lastFollowers,
      followerChange: firstFollowers == null || lastFollowers == null ? null : lastFollowers - firstFollowers,
      views,
    },
  };
  return { ok: true, report: { ...base, email: reportEmail(base) } };
}

export async function draftMonthlyReport(
  db: PortalDb,
  input: { creatorId: string; month: string; actorEmail: string; actorRole: string },
): Promise<Result<{ approvalId: string; report: MonthlyReport }>> {
  if (input.actorRole !== "admin") {
    return { ok: false, status: 403, error: "Only Kamron can draft the monthly report." };
  }
  const built = await buildMonthlyReport(db, input.creatorId, input.month);
  if (!built.ok) return built;
  const existing = await db
    .select()
    .from(creatorReportDrafts)
    .where(and(eq(creatorReportDrafts.creatorId, input.creatorId), eq(creatorReportDrafts.month, input.month)));
  if (existing[0]) {
    return { ok: false, status: 409, error: "This month's report is already in the approval queue. Nothing was sent." };
  }
  const creatorRows = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  const creator = creatorRows[0];
  if (!creator) return { ok: false, status: 404, error: "Creator not found." };
  const dealRows = await db.select().from(deals).where(eq(deals.creatorId, input.creatorId));
  const visible = dealRows.filter((deal) => deal.visibleToCreator);
  const anchor = visible.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!anchor) return { ok: false, status: 400, error: "She needs a deal on the books before this email can be queued." };
  const drafted = await createApprovalEmail(db, {
    dealId: anchor.id,
    gate: "report",
    to: creator.email,
    subject: built.report.email.subject,
    body: built.report.email.body,
  }, { email: input.actorEmail, role: "admin" });
  if (!drafted.ok) return drafted;
  await db.insert(creatorReportDrafts).values({
    id: crypto.randomUUID(),
    creatorId: input.creatorId,
    month: input.month,
    approvalId: drafted.id,
    createdAt: nowIso(),
  });
  const queued = await db.select().from(approvalEmails).where(eq(approvalEmails.id, drafted.id));
  if (queued[0]?.status !== "pending") {
    return { ok: false, status: 409, error: "This month's report is already in the approval queue. Nothing was sent." };
  }
  return { ok: true, approvalId: drafted.id, report: built.report };
}
