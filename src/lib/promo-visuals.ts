import { and, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { campaigns, deals, giftedOffers, gmailBridgeMessages, gmailBridgeThreads, promoImageFiles, promoVisuals } from "@/db/schema";
import { brandKey } from "./brand-crm";
import { nowIso, withBasePath } from "./format";
import {
  choosePromoImage,
  extractOpenGraphImage,
  imageUrlsInText,
  isImageReference,
  isSkippableImage,
  publicImagePageUrl,
  type PromoCandidate,
  type PromoChoice,
} from "./promo-image";

export type PromoSubjectType = "deal" | "offer" | "gift";

export type PromoSubject = {
  key: string;
  type: PromoSubjectType | "review";
  id: string;
  brand: string;
  productName: string | null;
  gmailThreadId?: string | null;
  dealId?: string | null;
  ownerUrls?: string[];
};

export type PromoView = {
  choice: PromoChoice | null;
  productName: string | null;
  productPageUrl: string | null;
  ownerImageUrl: string | null;
};

type StoredVisual = typeof promoVisuals.$inferSelect;

const WEBSITE_TTL_MS = 24 * 60 * 60 * 1000;

function emptyView(): PromoView {
  return { choice: null, productName: null, productPageUrl: null, ownerImageUrl: null };
}

function parseAttachments(raw: string): { id: string; filename: string; mimeType: string }[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { id?: unknown; filename?: unknown; mimeType?: unknown };
      if (typeof row.id !== "string" || typeof row.filename !== "string") return [];
      return [{ id: row.id, filename: row.filename, mimeType: typeof row.mimeType === "string" ? row.mimeType : "" }];
    });
  } catch {
    return [];
  }
}

export function websiteCacheStale(checkedAt: string | null, now = Date.now()) {
  if (!checkedAt) return true;
  const then = Date.parse(checkedAt);
  if (Number.isNaN(then)) return true;
  return now - then > WEBSITE_TTL_MS;
}

export async function readProductPageImage(pageUrl: string) {
  const safe = publicImagePageUrl(pageUrl);
  if (!safe) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(safe, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/html" },
    });
    if (!response.ok) return null;
    const finalUrl = publicImagePageUrl(response.url || safe);
    if (!finalUrl) return null;
    const html = (await response.text()).slice(0, 200_000);
    return extractOpenGraphImage(html, finalUrl);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshWebsiteImage(db: PortalDb, row: StoredVisual) {
  if (!row.productPageUrl || !websiteCacheStale(row.websiteCheckedAt)) return row;
  const imageUrl = await readProductPageImage(row.productPageUrl);
  const checkedAt = nowIso();
  await db.update(promoVisuals).set({
    websiteImageUrl: imageUrl,
    websiteCheckedAt: checkedAt,
    updatedAt: checkedAt,
  }).where(eq(promoVisuals.id, row.id));
  return { ...row, websiteImageUrl: imageUrl, websiteCheckedAt: checkedAt };
}

function emailCandidates(
  subject: PromoSubject,
  threads: (typeof gmailBridgeThreads.$inferSelect)[],
  messages: (typeof gmailBridgeMessages.$inferSelect)[],
): PromoCandidate[] {
  const exact = threads.filter((thread) => (
    (subject.dealId && thread.dealId === subject.dealId)
    || (subject.gmailThreadId && thread.threadId === subject.gmailThreadId)
  ));
  const matched = exact.length > 0
    ? exact
    : threads.filter((thread) => brandKey(thread.brand) === brandKey(subject.brand));
  const threadIds = new Set(matched.map((thread) => thread.id));
  const candidates: PromoCandidate[] = [];
  for (const message of messages) {
    if (!threadIds.has(message.threadRowId)) continue;
    for (const file of parseAttachments(message.attachmentsJson)) {
      if (!isImageReference(file.filename, file.mimeType) || isSkippableImage(file.filename)) continue;
      const url = withBasePath(
        `/api/gmail/threads/${encodeURIComponent(message.threadRowId)}/attachments/${encodeURIComponent(file.id)}?message=${encodeURIComponent(message.messageId)}`,
      );
      candidates.push({ source: "email", url, filename: file.filename, alt: message.subject });
    }
    for (const url of imageUrlsInText(`${message.snippet}\n${message.subject}`)) {
      candidates.push({ source: "email", url, filename: url, alt: message.subject });
    }
  }
  return candidates;
}

function viewFor(
  subject: PromoSubject,
  stored: StoredVisual | null,
  email: PromoCandidate[],
): PromoView {
  const productName = stored?.productName?.trim() || subject.productName?.trim() || null;
  const pageUrl = stored?.productPageUrl ?? null;
  const ownerImageUrl = stored?.ownerImageUrl ?? null;
  const website: PromoCandidate[] = stored?.websiteImageUrl && pageUrl
    ? [{ source: "website", url: stored.websiteImageUrl, pageUrl, filename: stored.websiteImageUrl, alt: productName }]
    : [];
  const owner: PromoCandidate[] = [];
  if (ownerImageUrl) owner.push({ source: "owner", url: ownerImageUrl, filename: ownerImageUrl, alt: productName });
  for (const url of subject.ownerUrls ?? []) {
    if (url && url !== ownerImageUrl) owner.push({ source: "owner", url, filename: url, alt: productName });
  }
  return {
    choice: choosePromoImage({ brand: subject.brand, productName, email, website, owner }),
    productName,
    productPageUrl: pageUrl,
    ownerImageUrl,
  };
}

export async function loadPromoViews(db: PortalDb, subjects: PromoSubject[]): Promise<Record<string, PromoView>> {
  const views: Record<string, PromoView> = {};
  if (subjects.length === 0) return views;
  const [storedRows, threads, messages] = await Promise.all([
    db.select().from(promoVisuals),
    db.select().from(gmailBridgeThreads),
    db.select().from(gmailBridgeMessages),
  ]);
  const storedByKey = new Map(storedRows.map((row) => [`${row.subjectType}:${row.subjectId}`, row]));
  const refreshed = new Map<string, StoredVisual>();
  for (const subject of subjects) {
    if (subject.type === "review") continue;
    const row = storedByKey.get(`${subject.type}:${subject.id}`);
    if (!row || refreshed.has(row.id)) continue;
    refreshed.set(row.id, await refreshWebsiteImage(db, row));
  }
  for (const subject of subjects) {
    const lookupType = subject.type === "review" ? "review" : subject.type;
    const row = refreshed.get(storedByKey.get(`${lookupType}:${subject.id}`)?.id ?? "") ?? storedByKey.get(`${lookupType}:${subject.id}`) ?? null;
    const email = emailCandidates(subject, threads, messages);
    views[subject.key] = viewFor(subject, row, email);
  }
  return views;
}

export async function promoViewsForDeals(
  db: PortalDb,
  dealsIn: { id: string; brand: string; subtitle: string | null; gmailThreadId?: string | null }[],
) {
  const rows = await db.select({ id: deals.id, gmailThreadId: deals.gmailThreadId, subtitle: deals.subtitle }).from(deals);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return loadPromoViews(db, dealsIn.map((deal) => {
    const row = byId.get(deal.id);
    return {
      key: deal.id,
      type: "deal" as const,
      id: deal.id,
      brand: deal.brand,
      productName: row?.subtitle ?? deal.subtitle,
      gmailThreadId: row?.gmailThreadId ?? deal.gmailThreadId ?? null,
      dealId: deal.id,
    };
  }));
}

export async function promoViewsForOffers(
  db: PortalDb,
  offers: { id: string; brand: string; deliverables: string[] }[],
) {
  return loadPromoViews(db, offers.map((offer) => ({
    key: offer.id,
    type: "offer" as const,
    id: offer.id,
    brand: offer.brand,
    productName: offer.deliverables[0] ?? null,
    dealId: null,
  })));
}

export async function promoViewsForGifts(
  db: PortalDb,
  gifts: { id: string; brand: string; product: string; photos: string[] }[],
) {
  return loadPromoViews(db, gifts.map((gift) => ({
    key: gift.id,
    type: "gift" as const,
    id: gift.id,
    brand: gift.brand,
    productName: gift.product,
    ownerUrls: gift.photos,
    dealId: null,
  })));
}

export function blankPromoView(): PromoView {
  return emptyView();
}

type SaveResult = { ok: true; id: string } | { ok: false; error: string };

async function subjectExists(db: PortalDb, type: PromoSubjectType, id: string) {
  if (type === "deal") {
    const rows = await db.select({ id: deals.id }).from(deals).where(eq(deals.id, id));
    return Boolean(rows[0]);
  }
  if (type === "offer") {
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return Boolean(rows[0] && rows[0].kind === "offer");
  }
  const rows = await db.select({ id: giftedOffers.id }).from(giftedOffers).where(eq(giftedOffers.id, id));
  return Boolean(rows[0]);
}

export async function savePromoVisual(
  db: PortalDb,
  viewer: { role: string },
  input: {
    subjectType: string;
    subjectId: string;
    productName?: string | null;
    productPageUrl?: string | null;
    ownerImageUrl?: string | null;
    upload?: { mimeType: string; bytes: Uint8Array } | null;
  },
): Promise<SaveResult> {
  if (viewer.role !== "admin") return { ok: false, error: "Only Kamron can save a product image." };
  const subjectType = input.subjectType;
  if (subjectType !== "deal" && subjectType !== "offer" && subjectType !== "gift") {
    return { ok: false, error: "That item is not on file." };
  }
  const subjectId = input.subjectId.trim();
  if (!subjectId || !(await subjectExists(db, subjectType, subjectId))) {
    return { ok: false, error: "That item is not on file." };
  }
  const pageRaw = input.productPageUrl?.trim() ?? "";
  const pageUrl = pageRaw ? publicImagePageUrl(pageRaw) : null;
  if (pageRaw && !pageUrl) return { ok: false, error: "Use a public https link, or leave it blank." };
  const ownerRaw = input.ownerImageUrl?.trim() ?? "";
  let ownerUrl = ownerRaw ? publicImagePageUrl(ownerRaw) : null;
  if (ownerRaw && !ownerUrl) return { ok: false, error: "Use a public https link, or leave it blank." };
  const upload = input.upload ?? null;
  if (upload && upload.bytes.byteLength > 0) {
    if (!upload.mimeType.toLowerCase().startsWith("image/") || upload.bytes.byteLength > 750_000) {
      return { ok: false, error: "Upload an image under 750 KB." };
    }
  }
  const timestamp = nowIso();
  const existing = await db.select().from(promoVisuals).where(and(
    eq(promoVisuals.subjectType, subjectType),
    eq(promoVisuals.subjectId, subjectId),
  ));
  const id = existing[0]?.id ?? crypto.randomUUID();
  const productName = input.productName?.trim() ? input.productName.trim().slice(0, 160) : null;
  const pageChanged = (existing[0]?.productPageUrl ?? null) !== pageUrl;
  if (upload && upload.bytes.byteLength > 0) {
    ownerUrl = withBasePath(`/api/promo-image/${id}`);
    const bytesBase64 = Buffer.from(upload.bytes).toString("base64");
    const file = await db.select().from(promoImageFiles).where(eq(promoImageFiles.visualId, id));
    if (file[0]) {
      await db.update(promoImageFiles).set({ mimeType: upload.mimeType, bytesBase64 }).where(eq(promoImageFiles.visualId, id));
    } else {
      await db.insert(promoImageFiles).values({ visualId: id, mimeType: upload.mimeType, bytesBase64 });
    }
  }
  const saved = {
    productName,
    productPageUrl: pageUrl,
    ownerImageUrl: ownerUrl,
    websiteImageUrl: pageChanged ? null : existing[0]?.websiteImageUrl ?? null,
    websiteCheckedAt: pageChanged ? null : existing[0]?.websiteCheckedAt ?? null,
    updatedAt: timestamp,
  };
  if (existing[0]) {
    await db.update(promoVisuals).set(saved).where(eq(promoVisuals.id, id));
  } else {
    await db.insert(promoVisuals).values({ id, subjectType, subjectId, ...saved });
  }
  return { ok: true, id };
}
