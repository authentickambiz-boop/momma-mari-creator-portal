/**
 * Public Holiday Gift Guide 2026 offer.
 * Prices here are the brand-facing "from" prices Kamron approved on Oct 21, 2026.
 * Do not fill them from a creator's private rate, floor, or the agency fee split.
 */

import { eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { approvalEmails, approvalEvents, brandContacts, brandCrmEntries, giftGuideReservations } from "@/db/schema";
import { BRAND_EMAIL_SENDER } from "./approvals";
import { isOwner } from "./authz";
import { recordBriefNotice } from "./brief-notify";
import { recordBrandInquiry } from "./brand-crm";
import { formatMoney, normalizeEmail, nowIso } from "./format";
import type { Viewer } from "./types";

type Fail = { ok: false; status: number; error: string };

export const GIFT_GUIDE_OFFER = {
  program: "gift-guide",
  inquiryPath: "/inquire?program=gift-guide",
  pagePath: "/gift-guide",
  title: "Holiday Gift Guide 2026",
  sponsoredLine: "Sponsored gift guide. Brands paid to be included.",
  lede: "Creators share gifts they'd actually give, in short roundup videos and on a shoppable page.",
  liveLabel: "Content is live Nov 20 to Dec 12, 2026, through Black Friday and Cyber Monday.",
  pageLabel: "The gift-guide page stays up through Dec 31.",
  emptyState: "Guide launches Nov 20.",
  reserveNote: "Reserving is free. Nothing is charged when you reserve.",
  disclosure: "Every placement is labeled as a paid partnership. Creators only feature products they approve.",
  capacityNote: "Each roundup video holds at most 5 products.",
  productsPerRoundup: 5,
  packages: [
    {
      id: "web",
      name: "Web Listing",
      summary: "Product card on the gift-guide page through Dec 31, plus a link-in-bio Gift Guide block.",
      priceCents: 14900,
      from: false,
      quoted: false,
      benchSlots: 0,
      rosterSlots: 0,
    },
    {
      id: "bench",
      name: "Bench Roundup Spot",
      summary: "Web listing plus 1 of up to 5 slots in a bench creator's roundup video on 1 platform.",
      priceCents: 39900,
      from: true,
      quoted: false,
      benchSlots: 1,
      rosterSlots: 0,
    },
    {
      id: "roster",
      name: "Roster Roundup Spot",
      summary: "Web listing plus 1 of up to 5 slots in a roster creator's roundup, cross-posted to 2 platforms.",
      priceCents: 95000,
      from: true,
      quoted: true,
      benchSlots: 0,
      rosterSlots: 1,
    },
    {
      id: "bundle",
      name: "Holiday Bundle",
      summary: "Web listing plus 2 bench spots and 1 roster spot across 3 different creators.",
      priceCents: 165000,
      from: true,
      quoted: true,
      benchSlots: 2,
      rosterSlots: 1,
    },
    {
      id: "headliner",
      name: "Headliner",
      summary: "A dedicated video from a roster creator in the guide series.",
      priceCents: null,
      from: false,
      quoted: true,
      benchSlots: 0,
      rosterSlots: 0,
    },
  ],
  addons: [
    { id: "paid-ads", name: "30-day paid-ads usage", priceLabel: "Quoted" },
    { id: "spark", name: "Spark/Partnership code", priceLabel: "Quoted" },
    { id: "cross-post", name: "Extra cross-post", priceLabel: "Quoted" },
    { id: "bfcm", name: "BF/CM code callout", priceLabel: "Quoted" },
  ],
  categories: [
    { id: "new-parents", label: "New parents" },
    { id: "toddlers-kids", label: "Toddlers/kids" },
    { id: "home-cook-dads", label: "Home cook/dads" },
    { id: "tech", label: "Tech gifts" },
    { id: "active", label: "Active parents" },
    { id: "moms", label: "Moms/stocking stuffers" },
    { id: "other", label: "Other" },
  ],
  acknowledgments: [
    { id: "ackPaid", label: "I understand content is clearly labeled as paid and #ad." },
    { id: "ackApproval", label: "I understand every creator approves every product." },
    { id: "ackKids", label: "I understand kids' products need a Children's Product Certificate and pass a CPSC recall check." },
    { id: "ackUpfront", label: "I understand new brands pay 50% upfront before filming." },
  ],
} as const;

export const GIFT_GUIDE_STATUS_REQUESTED = "requested";

const ERRORS = {
  brand: "Add the brand name.",
  name: "Add your name.",
  email: "Use a real work email.",
  website: "Add a full website, like https://brand.com.",
  product: "Add the product name.",
  url: "Add a full product link, like https://brand.com/product.",
  price: "Add the retail price in dollars.",
  category: "Choose a gift category.",
  package: "Choose a package.",
  ack: "Confirm each acknowledgment.",
} as const;

export type GiftGuideErrorCode = keyof typeof ERRORS;

export type GiftGuidePackage = (typeof GIFT_GUIDE_OFFER.packages)[number];
export type GiftGuideCategory = (typeof GIFT_GUIDE_OFFER.categories)[number];

export function giftGuidePriceLabel(item: { priceCents: number | null; from: boolean; quoted: boolean }) {
  if (item.priceCents == null) return "Custom quote";
  const money = formatMoney(item.priceCents);
  if (!item.from) return money;
  return item.quoted ? `from ${money} (quoted)` : `from ${money}`;
}

export function giftGuidePackage(id: string) {
  return GIFT_GUIDE_OFFER.packages.find((item) => item.id === id) ?? null;
}

export function giftGuideCategory(id: string) {
  return GIFT_GUIDE_OFFER.categories.find((item) => item.id === id) ?? null;
}

export function giftGuideErrorCode(error: string) {
  const match = (Object.keys(ERRORS) as GiftGuideErrorCode[]).find((code) => ERRORS[code] === error);
  return match ?? "1";
}

export function giftGuideErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return ERRORS[code as GiftGuideErrorCode] ?? null;
}

function clip(value: string | null | undefined, max: number) {
  return (value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().replace(/\s+/g, " ").slice(0, max);
}

function clipBlock(value: string | null | undefined, max: number) {
  return (value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function httpUrl(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

function retailCents(value: string | null | undefined) {
  const cleaned = (value ?? "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 100_000_000) return null;
  return cents;
}

function acknowledged(value: string | null | undefined) {
  const text = (value ?? "").trim().toLowerCase();
  return text === "on" || text === "yes" || text === "1" || text === "true";
}

function workEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email.includes("@") || email.endsWith(".invalid") || email.startsWith("@") || email.endsWith("@")) return null;
  return email;
}

export type GiftGuideReservationInput = {
  brand: string;
  contactName: string;
  email: string;
  website?: string | null;
  productName: string;
  productUrl: string;
  retailPrice: string;
  category: string;
  packageId: string;
  promoCode?: string | null;
  notes?: string | null;
  ackPaid?: string | null;
  ackApproval?: string | null;
  ackKids?: string | null;
  ackUpfront?: string | null;
  honeypot?: string | null;
};

export type GiftGuideConfirmationInput = {
  brand: string;
  contactName: string;
  productName: string;
  productUrl: string;
  retailPriceCents: number;
  categoryLabel: string;
  packageName: string;
  priceLabel: string;
  promoCode: string | null;
};

/** Brand-facing confirmation. It quotes the public package label only. */
export function giftGuideConfirmation(input: GiftGuideConfirmationInput) {
  const subject = `Holiday Gift Guide reservation for ${input.brand}`.slice(0, 180);
  const promo = input.promoCode ? `Promo code: ${input.promoCode}` : "Promo code: none yet";
  const body = [
    `Hi ${input.contactName},`,
    "",
    `Thank you for reserving a spot in the Momma Mari Holiday Gift Guide 2026 for ${input.brand}.`,
    "",
    `Product: ${input.productName}`,
    `Product link: ${input.productUrl}`,
    `Retail price: ${formatMoney(input.retailPriceCents)}`,
    `Category: ${input.categoryLabel}`,
    `Package: ${input.packageName} — ${input.priceLabel}`,
    promo,
    "",
    "Reserving is free. Nothing has been charged. We will follow up with the next step.",
    "",
    "Content is live Nov 20 to Dec 12, 2026. The page stays up through Dec 31. Every placement is labeled as a paid partnership, and every creator approves every product.",
    "",
    "Momma Mari",
  ].join("\n");
  return { subject, body };
}

/** Every brand-facing string for the guide: page, form, and confirmation draft. */
export function brandFacingGiftGuideText() {
  const sampleRetail = 1800;
  const lines = [
    GIFT_GUIDE_OFFER.title,
    GIFT_GUIDE_OFFER.sponsoredLine,
    GIFT_GUIDE_OFFER.lede,
    GIFT_GUIDE_OFFER.liveLabel,
    GIFT_GUIDE_OFFER.pageLabel,
    GIFT_GUIDE_OFFER.emptyState,
    GIFT_GUIDE_OFFER.reserveNote,
    GIFT_GUIDE_OFFER.disclosure,
    GIFT_GUIDE_OFFER.capacityNote,
    "Reserve a spot",
    "Brand name",
    "Your name",
    "Work email",
    "Website",
    "Product name",
    "Product link",
    "Retail price",
    "Gift category",
    "Package",
    "Black Friday or Cyber Monday code",
    "Notes",
    ...GIFT_GUIDE_OFFER.packages.flatMap((item) => [item.name, item.summary, giftGuidePriceLabel(item)]),
    ...GIFT_GUIDE_OFFER.addons.flatMap((item) => [item.name, item.priceLabel]),
    ...GIFT_GUIDE_OFFER.categories.map((item) => item.label),
    ...GIFT_GUIDE_OFFER.acknowledgments.map((item) => item.label),
    ...Object.values(ERRORS),
    ...GIFT_GUIDE_OFFER.packages.map((item) => {
      const copy = giftGuideConfirmation({
        brand: "Sample Brand",
        contactName: "Sample Contact",
        productName: "Sample Product",
        productUrl: "https://example.com/product",
        retailPriceCents: sampleRetail,
        categoryLabel: GIFT_GUIDE_OFFER.categories[0].label,
        packageName: item.name,
        priceLabel: giftGuidePriceLabel(item),
        promoCode: null,
      });
      return `${copy.subject}\n${copy.body}`;
    }),
  ];
  return lines.join("\n");
}

function videosFor(slots: number) {
  if (slots <= 0) return 0;
  return Math.ceil(slots / GIFT_GUIDE_OFFER.productsPerRoundup);
}

export function summarizeGiftGuide(rows: { packageId: string; category: string; status: string }[]) {
  const requested = rows.filter((row) => row.status === GIFT_GUIDE_STATUS_REQUESTED);
  let benchSlotsRequested = 0;
  let rosterSlotsRequested = 0;
  const byPackage = GIFT_GUIDE_OFFER.packages.map((item) => {
    const count = requested.filter((row) => row.packageId === item.id).length;
    benchSlotsRequested += count * item.benchSlots;
    rosterSlotsRequested += count * item.rosterSlots;
    return { id: item.id, name: item.name, count, priceLabel: giftGuidePriceLabel(item) };
  });
  const byCategory = GIFT_GUIDE_OFFER.categories.map((item) => ({
    id: item.id,
    name: item.label,
    count: requested.filter((row) => row.category === item.id).length,
  }));
  return {
    total: requested.length,
    byPackage,
    byCategory,
    benchSlotsRequested,
    rosterSlotsRequested,
    roundupSlotsRequested: benchSlotsRequested + rosterSlotsRequested,
    productsPerRoundup: GIFT_GUIDE_OFFER.productsPerRoundup,
    benchVideosNeeded: videosFor(benchSlotsRequested),
    rosterVideosNeeded: videosFor(rosterSlotsRequested),
  };
}

export type GiftGuideReservationView = {
  id: string;
  brandName: string;
  contactName: string;
  email: string;
  productName: string;
  categoryLabel: string;
  packageName: string;
  priceLabel: string;
  retailPriceLabel: string;
  status: string;
  createdAt: string;
};

export async function listGiftGuideReservations(db: PortalDb, viewer: Viewer) {
  if (!isOwner(viewer)) return { ok: false as const, status: 403, error: "Gift guide reservations are on the owner's sign-in." };
  const rows = await db.select().from(giftGuideReservations);
  const summary = summarizeGiftGuide(rows);
  const reservations: GiftGuideReservationView[] = rows
    .slice()
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
    .map((row) => {
      const pkg = giftGuidePackage(row.packageId);
      const category = giftGuideCategory(row.category);
      return {
        id: row.id,
        brandName: row.brandName,
        contactName: row.contactName,
        email: row.email,
        productName: row.productName,
        categoryLabel: category?.label ?? row.category,
        packageName: pkg?.name ?? row.packageId,
        priceLabel: pkg ? giftGuidePriceLabel(pkg) : "",
        retailPriceLabel: formatMoney(row.retailPriceCents),
        status: row.status,
        createdAt: row.createdAt,
      };
    });
  return { ok: true as const, summary, reservations };
}

/** Stores a reservation, a brand contact, and a pending confirmation draft. The brand draft is not sent and nothing is charged. A staff notice is stored for Kamron. */
export async function saveGiftGuideReservation(
  db: PortalDb,
  input: GiftGuideReservationInput,
): Promise<{ ok: true; id: string; approvalId: string | null } | Fail> {
  if (input.honeypot?.trim()) return { ok: true, id: "dropped", approvalId: null };

  const brand = clip(input.brand, 160);
  if (!brand) return { ok: false, status: 400, error: ERRORS.brand };
  const contactName = clip(input.contactName, 120);
  if (!contactName) return { ok: false, status: 400, error: ERRORS.name };
  const email = workEmail(input.email ?? "");
  if (!email) return { ok: false, status: 400, error: ERRORS.email };
  const websiteRaw = (input.website ?? "").trim();
  const website = websiteRaw ? httpUrl(websiteRaw) : null;
  if (websiteRaw && !website) return { ok: false, status: 400, error: ERRORS.website };
  const productName = clip(input.productName, 160);
  if (!productName) return { ok: false, status: 400, error: ERRORS.product };
  const productUrl = httpUrl(input.productUrl);
  if (!productUrl) return { ok: false, status: 400, error: ERRORS.url };
  const price = retailCents(input.retailPrice);
  if (price == null) return { ok: false, status: 400, error: ERRORS.price };
  const category = giftGuideCategory(clip(input.category, 40));
  if (!category) return { ok: false, status: 400, error: ERRORS.category };
  const chosen = giftGuidePackage(clip(input.packageId, 40));
  if (!chosen) return { ok: false, status: 400, error: ERRORS.package };
  if (!acknowledged(input.ackPaid) || !acknowledged(input.ackApproval) || !acknowledged(input.ackKids) || !acknowledged(input.ackUpfront)) {
    return { ok: false, status: 400, error: ERRORS.ack };
  }
  const promoCode = clip(input.promoCode, 80) || null;
  const notes = clipBlock(input.notes, 2000) || null;
  const priceLabel = giftGuidePriceLabel(chosen);
  const copy = giftGuideConfirmation({
    brand,
    contactName,
    productName,
    productUrl,
    retailPriceCents: price,
    categoryLabel: category.label,
    packageName: chosen.name,
    priceLabel,
    promoCode,
  });
  const note = [
    "Holiday Gift Guide 2026 reservation. Status: requested.",
    `Product: ${productName}`,
    `Package: ${chosen.name} (${priceLabel})`,
    `Category: ${category.label}`,
    website ? `Website: ${website}` : null,
    promoCode ? `Promo code: ${promoCode}` : null,
    notes ? `Notes: ${notes}` : null,
  ].filter((line): line is string => Boolean(line)).join("\n").slice(0, 8000);

  const saved = await recordBrandInquiry(db, {
    brand,
    contactName,
    contactEmail: email,
    note,
  });
  if (!saved.ok) return saved;

  const id = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  const contactId = crypto.randomUUID();
  const timestamp = nowIso();
  await db.insert(approvalEmails).values({
    id: approvalId,
    dealId: `gift-guide:${id}`,
    gate: "gift_guide",
    status: "pending",
    toEmail: email,
    subject: copy.subject,
    body: copy.body,
    attachmentNote: `Gift guide reservation ${id}`,
    attachmentUrl: null,
    fromEmail: BRAND_EMAIL_SENDER,
    gmailThreadId: null,
    gmailMessageId: null,
    sentAt: null,
    brandContactName: contactName,
    brandContactEmail: email,
    brandContactCompany: brand,
    suggestedCreatorId: null,
    suggestedPlan: chosen.name,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(approvalEvents).values({
    id: crypto.randomUUID(),
    approvalId,
    action: "created",
    actorEmail: "portal",
    actorRole: "bot",
    subject: copy.subject,
    body: copy.body,
    note: "Draft only. Nothing was sent.",
    createdAt: timestamp,
  });
  await db.insert(brandContacts).values({
    id: contactId,
    dealId: null,
    approvalId,
    company: brand,
    contactName,
    contactEmail: email,
    note,
    suggestedCreatorId: null,
    suggestedPlan: chosen.name,
    savedBy: "Website",
    createdAt: timestamp,
  });
  await db.insert(giftGuideReservations).values({
    id,
    brandCrmId: saved.id,
    brandContactId: contactId,
    approvalId,
    brandName: brand,
    contactName,
    email,
    website,
    productName,
    productUrl,
    retailPriceCents: price,
    category: category.id,
    packageId: chosen.id,
    promoCode,
    notes,
    ackPaid: true,
    ackApproval: true,
    ackKids: true,
    ackUpfront: true,
    status: GIFT_GUIDE_STATUS_REQUESTED,
    createdAt: timestamp,
  });
  const crm = await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.id, saved.id));
  if (!crm[0]) return { ok: false, status: 500, error: "The reservation was not saved." };
  await recordBriefNotice(db, {
    source: "gift-guide",
    sourceId: id,
    brand,
    contactName,
    contactEmail: email,
    program: GIFT_GUIDE_OFFER.program,
    budget: `${chosen.name}: ${priceLabel}`,
  });
  return { ok: true, id, approvalId };
}
