import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { brandCampaignReports, creators, deals, usageRights } from "@/db/schema";
import { nowIso } from "./format";
import type { Viewer } from "./types";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type PublicBrandReport = {
  title: string;
  brand: string;
  creatorName: string;
  creatorId: string;
  views: string | null;
  engagement: string | null;
  clicks: string | null;
  comments: string | null;
  links: string | null;
  usageEndsOn: string | null;
  exclusivityEndsOn: string | null;
  rebookHref: string;
};

function token() {
  return crypto.randomUUID().replace(/-/g, "");
}

/** A share link for a brand. Priced packages and invoices are not created here. */
export async function openBrandReport(db: PortalDb, viewer: Viewer, dealId: string): Promise<Result<{ token: string }>> {
  if (viewer.role !== "admin") return { ok: false, status: 403, error: "Only the owner can open a brand report." };
  const dealRows = await db.select().from(deals).where(eq(deals.id, dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const existing = await db.select().from(brandCampaignReports).where(eq(brandCampaignReports.dealId, deal.id));
  if (existing[0]) return { ok: true, token: existing[0].token };
  const created = token();
  await db.insert(brandCampaignReports).values({
    id: crypto.randomUUID(),
    token: created,
    dealId: deal.id,
    title: `${deal.brand} campaign report`,
    viewsLabel: null,
    engagementLabel: null,
    clicksLabel: null,
    commentsLabel: null,
    contentLinks: null,
    createdAt: nowIso(),
  });
  return { ok: true, token: created };
}

export async function listBrandReports(db: PortalDb, viewer: Viewer) {
  if (viewer.role !== "admin") return [];
  const [reports, dealRows] = await Promise.all([
    db.select().from(brandCampaignReports),
    db.select({ id: deals.id, brand: deals.brand }).from(deals),
  ]);
  const brands = new Map(dealRows.map((deal) => [deal.id, deal.brand]));
  return reports
    .map((report) => ({ token: report.token, dealId: report.dealId, title: report.title, brand: brands.get(report.dealId) ?? report.title }))
    .sort((left, right) => left.brand.localeCompare(right.brand));
}

export async function publicBrandReport(db: PortalDb, reportToken: string): Promise<PublicBrandReport | null> {
  const rows = await db.select().from(brandCampaignReports).where(eq(brandCampaignReports.token, reportToken));
  const report = rows[0];
  if (!report) return null;
  const dealRows = await db.select().from(deals).where(eq(deals.id, report.dealId));
  const deal = dealRows[0];
  if (!deal) return null;
  const [people, rights] = await Promise.all([
    db.select({ id: creators.id, name: creators.name }).from(creators).where(eq(creators.id, deal.creatorId)),
    db.select().from(usageRights).where(eq(usageRights.dealId, deal.id)),
  ]);
  return {
    title: report.title,
    brand: deal.brand,
    creatorName: people[0]?.name ?? "Creator",
    creatorId: deal.creatorId,
    views: report.viewsLabel,
    engagement: report.engagementLabel,
    clicks: report.clicksLabel,
    comments: report.commentsLabel,
    links: report.contentLinks,
    usageEndsOn: rights[0]?.endsOn ?? null,
    exclusivityEndsOn: rights[0]?.exclusivityEndsOn ?? null,
    rebookHref: `/inquire?with=${encodeURIComponent(deal.creatorId)}`,
  };
}
