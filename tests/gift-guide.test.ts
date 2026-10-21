import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, brandContacts, brandCrmEntries, creators, giftGuideReservations } from "../src/db/schema";
import { listApprovalQueue, listSendableApprovals, markApprovalSent, reviewApproval } from "../src/lib/approvals";
import { rulesFor } from "../src/lib/deal-rules";
import { AGENCY_COMMISSION_PERCENT, formatMoney } from "../src/lib/format";
import {
  GIFT_GUIDE_OFFER,
  GIFT_GUIDE_STATUS_REQUESTED,
  brandFacingGiftGuideText,
  giftGuideErrorCode,
  giftGuidePackage,
  giftGuidePriceLabel,
  listGiftGuideReservations,
  saveGiftGuideReservation,
  type GiftGuideReservationInput,
} from "../src/lib/gift-guide";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { sitemapPublicPaths } from "../src/lib/public-meta";
import { getDealForViewer } from "../src/lib/queries";
import { admin, mariclare, openTestDb } from "./harness";

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

function reservation(overrides: Partial<GiftGuideReservationInput> = {}): GiftGuideReservationInput {
  return {
    brand: "Cedar Soap",
    contactName: "June Buyer",
    email: "june.buyer@cedarsoap.test",
    website: "https://cedarsoap.test",
    productName: "Cloud Wash",
    productUrl: "https://cedarsoap.test/cloud-wash",
    retailPrice: "18",
    category: "new-parents",
    packageId: "bench",
    promoCode: "HOLIDAY",
    notes: "Please feature the unscented bottle.",
    ackPaid: "yes",
    ackApproval: "yes",
    ackKids: "yes",
    ackUpfront: "yes",
    honeypot: "",
    ...overrides,
  };
}

describe("holiday gift guide reservations", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("the form rejects a bad reservation and stores nothing", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const rowsBefore = (await db.select().from(giftGuideReservations)).length;
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    const blank = await saveGiftGuideReservation(db, reservation({ brand: "   " }));
    assert.equal(blank.ok, false);
    if (!blank.ok) {
      assert.equal(blank.error, "Add the brand name.");
      assert.equal(giftGuideErrorCode(blank.error), "brand");
    }

    const email = await saveGiftGuideReservation(db, reservation({ email: "june.buyer@cedarsoap.invalid" }));
    assert.equal(email.ok, false);
    if (!email.ok) assert.equal(email.error, "Use a real work email.");

    const product = await saveGiftGuideReservation(db, reservation({ productName: " " }));
    assert.equal(product.ok, false);
    if (!product.ok) assert.equal(product.error, "Add the product name.");

    const url = await saveGiftGuideReservation(db, reservation({ productUrl: "not a link" }));
    assert.equal(url.ok, false);
    if (!url.ok) assert.equal(url.error, "Add a full product link, like https://brand.com/product.");

    const price = await saveGiftGuideReservation(db, reservation({ retailPrice: "free" }));
    assert.equal(price.ok, false);
    if (!price.ok) assert.equal(price.error, "Add the retail price in dollars.");

    const category = await saveGiftGuideReservation(db, reservation({ category: "pets" }));
    assert.equal(category.ok, false);
    if (!category.ok) assert.equal(category.error, "Choose a gift category.");

    const pkg = await saveGiftGuideReservation(db, reservation({ packageId: "platinum" }));
    assert.equal(pkg.ok, false);
    if (!pkg.ok) assert.equal(pkg.error, "Choose a package.");

    const ack = await saveGiftGuideReservation(db, reservation({ ackKids: "" }));
    assert.equal(ack.ok, false);
    if (!ack.ok) assert.equal(ack.error, "Confirm each acknowledgment.");

    const dropped = await saveGiftGuideReservation(db, reservation({ honeypot: "https://spam.test" }));
    assert.equal(dropped.ok, true);
    if (dropped.ok) assert.equal(dropped.id, "dropped");

    assert.equal((await db.select().from(giftGuideReservations)).length, rowsBefore);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
  });

  test("a reservation is stored, linked to a brand contact, and queued as a draft", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const saved = await saveGiftGuideReservation(db, reservation());
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.ok(saved.approvalId);

    const row = (await db.select().from(giftGuideReservations).where(eq(giftGuideReservations.id, saved.id)))[0];
    assert.equal(row?.status, GIFT_GUIDE_STATUS_REQUESTED);
    assert.equal(row?.packageId, "bench");
    assert.equal(row?.category, "new-parents");
    assert.equal(row?.retailPriceCents, 1800);
    assert.equal(row?.promoCode, "HOLIDAY");
    assert.equal(row?.ackPaid, true);
    assert.equal(row?.ackKids, true);
    assert.equal(row?.ackUpfront, true);

    const contact = (await db.select().from(brandContacts).where(eq(brandContacts.id, row?.brandContactId ?? "")))[0];
    assert.equal(contact?.company, "Cedar Soap");
    assert.equal(contact?.contactEmail, "june.buyer@cedarsoap.test");
    assert.equal(contact?.approvalId, saved.approvalId);

    const crm = (await db.select().from(brandCrmEntries).where(eq(brandCrmEntries.id, row?.brandCrmId ?? "")))[0];
    assert.equal(crm?.kind, "inquiry");
    assert.equal(crm?.contactEmail, "june.buyer@cedarsoap.test");
    assert.match(crm?.note ?? "", /Holiday Gift Guide 2026/);

    const approval = (await db.select().from(approvalEmails).where(eq(approvalEmails.id, saved.approvalId)))[0];
    assert.equal(approval?.status, "pending");
    assert.equal(approval?.sentAt, null);
    assert.equal(approval?.gate, "gift_guide");
    assert.equal(approval?.toEmail, "june.buyer@cedarsoap.test");
    assert.match(approval?.body ?? "", /Nothing has been charged/);
    assert.equal((await listSendableApprovals(db)).some((item) => item.id === saved.approvalId), false);

    const queue = await listApprovalQueue(db, "all");
    const queued = queue.find((item) => item.id === saved.approvalId);
    assert.equal(queued?.status, "pending");
    assert.equal(queued?.brand, "Cedar Soap");
    assert.equal(queued?.gateLabel, "Gift guide reservation");

    const approved = await reviewApproval(db, {
      approvalId: saved.approvalId,
      intent: "approve",
      actorEmail: admin.email,
      actorRole: admin.role,
    });
    assert.equal(approved.ok, true);
    const sent = await markApprovalSent(db, saved.approvalId, { messageId: "should-not-send" }, { email: "portal", role: "bot" });
    assert.equal(sent.ok, false);
    const after = (await db.select().from(approvalEmails).where(eq(approvalEmails.id, saved.approvalId)))[0];
    assert.equal(after?.sentAt, null);
    assert.notEqual(after?.status, "sent");
    assert.equal((await listSendableApprovals(db)).some((item) => item.id === saved.approvalId), false);

    const hidden = await listGiftGuideReservations(db, mariclare);
    assert.equal(hidden.ok, false);

    const board = await listGiftGuideReservations(db, admin);
    assert.equal(board.ok, true);
    if (board.ok) {
      assert.equal(board.summary.byPackage.find((item) => item.id === "bench")?.count, 1);
      assert.equal(board.summary.byCategory.find((item) => item.id === "new-parents")?.count, 1);
      assert.equal(board.summary.roundupSlotsRequested, 1);
      assert.equal(board.reservations[0]?.status, "requested");
    }

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.visibleToCreator, true);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.contact, null);
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
    assert.equal(kosblingAfter?.contracts.length, 0);
  });

  test("the owner panel counts packages, categories, and roundup slots of 5", async () => {
    const specs: Partial<GiftGuideReservationInput>[] = [
      { brand: "North Web", email: "a@northweb.test", packageId: "web", category: "tech" },
      { brand: "Bench One", email: "a@benchone.test", packageId: "bench", category: "toddlers-kids" },
      { brand: "Bench Two", email: "a@benchtwo.test", packageId: "bench", category: "toddlers-kids" },
      { brand: "Bench Three", email: "a@benchthree.test", packageId: "bench", category: "active" },
      { brand: "Bench Four", email: "a@benchfour.test", packageId: "bench", category: "active" },
      { brand: "Bench Five", email: "a@benchfive.test", packageId: "bench", category: "moms" },
      { brand: "Bench Six", email: "a@benchsix.test", packageId: "bench", category: "moms" },
      { brand: "Roster One", email: "a@rosterone.test", packageId: "roster", category: "home-cook-dads" },
      { brand: "Bundle One", email: "a@bundleone.test", packageId: "bundle", category: "other" },
      { brand: "Headline One", email: "a@headlineone.test", packageId: "headliner", category: "new-parents" },
    ];
    for (const spec of specs) {
      const saved = await saveGiftGuideReservation(db, reservation(spec));
      assert.equal(saved.ok, true);
    }
    const board = await listGiftGuideReservations(db, admin);
    assert.equal(board.ok, true);
    if (!board.ok) return;
    const count = (id: string) => board.summary.byPackage.find((item) => item.id === id)?.count ?? 0;
    assert.equal(count("web"), 1);
    assert.equal(count("bench"), 7);
    assert.equal(count("roster"), 1);
    assert.equal(count("bundle"), 1);
    assert.equal(count("headliner"), 1);
    assert.equal(board.summary.byCategory.find((item) => item.id === "toddlers-kids")?.count, 2);
    assert.equal(board.summary.benchSlotsRequested, 9);
    assert.equal(board.summary.rosterSlotsRequested, 2);
    assert.equal(board.summary.roundupSlotsRequested, 11);
    assert.equal(board.summary.productsPerRoundup, 5);
    assert.equal(board.summary.benchVideosNeeded, 2);
    assert.equal(board.summary.rosterVideosNeeded, 1);

    const panel = source("src/components/gift-guide-reservations.tsx");
    const dashboard = source("src/app/dashboard/page.tsx");
    assert.match(panel, /Gift guide reservations/);
    assert.match(panel, /Roundup slots requested/);
    assert.match(dashboard, /GiftGuideReservationsPanel/);
  });

  test("brand-facing gift guide copy hides creator floors, rates, and the fee split", async () => {
    const people = await db.select().from(creators);
    const floors = new Set<number>();
    for (const person of people) {
      const rules = await rulesFor(db, person.id);
      if (rules.minDealCents) floors.add(rules.minDealCents);
      if (rules.typicalRateCents) floors.add(rules.typicalRateCents);
      for (const cents of Object.values(rules.minRates)) {
        if (cents) floors.add(cents);
      }
    }
    assert.equal(floors.size > 0, true);

    const drafts = await db.select().from(approvalEmails);
    const queuedCopy = drafts
      .filter((row) => row.gate === "gift_guide")
      .map((row) => `${row.subject}\n${row.body}`)
      .join("\n");
    const facing = [
      brandFacingGiftGuideText(),
      queuedCopy,
      source("src/app/gift-guide/page.tsx"),
      source("src/components/gift-guide-form.tsx"),
      source("src/app/inquire/page.tsx"),
    ].join("\n");
    for (const cents of floors) {
      assert.equal(facing.includes(formatMoney(cents)), false, formatMoney(cents));
    }
    assert.equal(facing.includes(`${AGENCY_COMMISSION_PERCENT}%`), false);
    assert.equal(facing.toLowerCase().includes("fee split"), false);
    assert.equal(facing.includes("80/20"), false);
    assert.equal(/\bfloor\b/i.test(facing), false);
    assert.equal(/\bminimum\b/i.test(facing), false);

    const web = giftGuidePackage("web");
    const bench = giftGuidePackage("bench");
    const roster = giftGuidePackage("roster");
    const bundle = giftGuidePackage("bundle");
    const headliner = giftGuidePackage("headliner");
    assert.ok(web);
    assert.ok(bench);
    assert.ok(roster);
    assert.ok(bundle);
    assert.ok(headliner);
    assert.equal(giftGuidePriceLabel(web), "$149");
    assert.equal(giftGuidePriceLabel(bench), "from $399");
    assert.equal(giftGuidePriceLabel(roster), "from $950 (quoted)");
    assert.equal(giftGuidePriceLabel(bundle), "from $1,650 (quoted)");
    assert.equal(giftGuidePriceLabel(headliner), "Custom quote");
    assert.equal(GIFT_GUIDE_OFFER.addons.every((item) => item.priceLabel === "Quoted"), true);
    assert.equal(source("src/lib/gift-guide.ts").includes("export const GIFT_GUIDE_OFFER"), true);
    assert.equal(source("src/app/gift-guide/page.tsx").includes("14900"), false);
    assert.equal(source("src/components/gift-guide-form.tsx").includes("$149"), false);
    assert.equal(source("src/lib/gift-guide.ts").includes("stripe"), false);
    assert.equal(source("src/app/gift-guide/page.tsx").includes("stripe"), false);

    const page = source("src/app/gift-guide/page.tsx");
    const form = source("src/components/gift-guide-form.tsx");
    const inquire = source("src/app/inquire/page.tsx");
    const copy = brandFacingGiftGuideText();
    assert.match(copy, /Guide launches Nov 20/);
    assert.match(copy, /Sponsored gift guide/);
    assert.match(copy, /Children's Product Certificate/);
    assert.match(copy, /50% upfront/);
    assert.match(page, /GIFT_GUIDE_OFFER\.emptyState/);
    assert.match(page, /GIFT_GUIDE_OFFER\.sponsoredLine/);
    assert.match(page, /GIFT_GUIDE_OFFER\.inquiryPath/);
    assert.match(form, /Product name/);
    assert.match(form, /acknowledgments/);
    assert.match(inquire, /program === GIFT_GUIDE_OFFER\.program/);
    assert.equal(GIFT_GUIDE_OFFER.inquiryPath, "/inquire?program=gift-guide");
    assert.equal(isPublicMarketingPath("/gift-guide", ""), true);
    assert.equal(isPublicMarketingPath("/portal/gift-guide", "/portal"), true);
    assert.equal(isPublicMarketingPath("/portal/inquire?program=gift-guide", "/portal"), true);
    assert.equal(sitemapPublicPaths().includes("/gift-guide"), true);
  });
});
