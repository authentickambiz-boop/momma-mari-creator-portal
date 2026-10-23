import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, brandCampaignReports, creatorOfferReviews, gmailBridgeThreads, usageRights } from "../src/db/schema";
import { saveBrandBrief } from "../src/lib/brand-brief";
import { openBrandReport, publicBrandReport } from "../src/lib/brand-report";
import { listBrandCrm } from "../src/lib/brand-crm";
import { decideCreatorDealReview, listCreatorDealReviews, listOwnerDealReviews } from "../src/lib/creator-deal-review";
import { creatorStartPath } from "../src/lib/questionnaire";
import { saveProfileIntake } from "../src/lib/profile-intake";
import { gmailSyncEnabled } from "../src/lib/gmail-sync-flag";
import { paymentsEnabled } from "../src/lib/payments-config";
import { visibleCaseStudies, visibleTestimonials, WORKED_WITH } from "../src/lib/proof";
import { publicPageMeta } from "../src/lib/public-meta";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { publicRosterFeed } from "../src/lib/roster-feed";
import { getDealForViewer } from "../src/lib/queries";
import { saveUsageRights, usageExpiryAlerts } from "../src/lib/usage";
import { admin, abby, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("site gap fixes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("legal footer, effective date, and a privacy line under the public forms", () => {
    const layout = source("src/app/layout.tsx");
    const footer = source("src/components/site-footer.tsx");
    const notice = source("src/components/privacy-notice.tsx");
    const privacy = source("src/app/privacy/page.tsx");
    const terms = source("src/app/terms/page.tsx");
    assert.match(layout, /SiteFooter/);
    assert.match(footer, /mommamari\.com/);
    assert.match(footer, /href="\/privacy"/);
    assert.match(footer, /href="\/terms"/);
    assert.match(footer, /Momma Mari LLC \(NC\)/);
    assert.match(notice, /By submitting you agree to our/);
    assert.match(notice, /Privacy Policy/);
    assert.match(source("src/components/brand-brief-form.tsx"), /PrivacyNotice/);
    assert.match(source("src/app/apply/page.tsx"), /PrivacyNotice/);
    assert.match(privacy, /LEGAL_EFFECTIVE_BANNER/);
    assert.match(terms, /LEGAL_EFFECTIVE_BANNER/);
    assert.match(source("src/lib/legal-banner.ts"), /Effective Oct 20, 2026, pending legal review/);
    assert.equal(privacy.includes("Effective October 20, 2026"), false);
    assert.equal(terms.includes("Effective October 20, 2026"), false);
    assert.equal(privacy.includes("DRAFT - not yet in effect"), false);
    assert.equal(terms.includes("DRAFT - not yet in effect"), false);
  });

  test("the brand brief stores a budget, files the deal inbox, and does not email", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const dropped = await saveBrandBrief(db, {
      brand: "Honeypot Co",
      email: "bot@honeypot.test",
      budget: "Under $1,000",
      creators: ["mariclare"],
      honeypot: "https://spam.example",
    });
    assert.equal(dropped.ok, true);
    const missingBudget = await saveBrandBrief(db, {
      brand: "No Budget",
      email: "pat@nobudget.test",
      creators: ["abby"],
    });
    assert.equal(missingBudget.ok, false);
    const saved = await saveBrandBrief(db, {
      brand: "Cedar Soap",
      companyWebsite: "https://cedarsoap.test",
      name: "June Buyer",
      title: "Partnerships",
      email: "June.Buyer@CedarSoap.test",
      phone: "919-555-0100",
      agency: "yes",
      clientBrand: "Cedar Soap",
      creators: ["mariclare", "recommend"],
      goal: "Clicks on a fall code",
      deliverables: "1 TikTok and 1 Instagram story",
      budget: "Under $1,000",
      budgetKind: "Paid",
      usage: "Organic only",
      usageDuration: "30 days",
      exclusivity: "None",
      timeline: "Ship Nov 1, live Nov 15",
      approvals: "One round",
      billingContact: "June Buyer",
      billingEmail: "ap@cedarsoap.test",
      legalEntity: "Cedar Soap LLC",
      poNeeded: "no",
      paymentTerms: "Net 30",
      paymentMethod: "ACH",
      deposit: "no",
      productSample: "yes",
      heardAbout: "Instagram",
    });
    assert.equal(saved.ok, true);
    const list = await listBrandCrm(db, admin);
    assert.equal(list.ok, true);
    if (list.ok) {
      const card = list.brands.find((item) => item.key === "cedar soap");
      assert.equal(card?.contacts.some((contact) => contact.email === "june.buyer@cedarsoap.test" && contact.source === "inquiry"), true);
      const note = card?.responses.find((row) => row.decision === "inquiry")?.note ?? "";
      assert.match(note, /Under \$1,000/);
      assert.match(note, /Deliverables: 1 TikTok/);
      assert.equal(note.toLowerCase().includes("minimum"), false);
    }
    const threads = await db.select().from(gmailBridgeThreads);
    const thread = threads.find((row) => row.brand === "Cedar Soap");
    assert.equal(thread?.classification, "inquiry");
    assert.equal(thread?.fromEmail, "june.buyer@cedarsoap.test");
    assert.equal(thread?.dealId, null);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    assert.equal(gmailSyncEnabled(), false);
    const page = source("src/app/inquire/page.tsx");
    const form = source("src/components/brand-brief-form.tsx");
    assert.match(page, /We have your brief/);
    assert.match(page, /REPLY_PROMISE/);
    assert.match(form, /Budget/);
    assert.match(form, /Deliverables/);
    assert.match(form, /Usage rights/);
    assert.match(source("src/lib/brand-brief.ts"), /Under \$1,000/);
    assert.match(source("src/lib/brand-brief.ts"), /\$1,000–\$5,000/);
    assert.equal(form.toLowerCase().includes("minimum"), false);
    assert.equal(form.includes("rate card"), false);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
  });

  test("the roster feed is the three creators and about 2.95M followers", async () => {
    const feed = await publicRosterFeed(db);
    assert.deepEqual(feed.creators.map((creator) => creator.id), ["abby", "authentickam", "mariclare"]);
    assert.deepEqual(feed.creators.map((creator) => creator.displayName), ["Abby", "AuthenticKam", "MariClare"]);
    assert.equal(feed.combinedFollowers, 2_947_731);
    assert.equal(feed.combinedLabel, "2.95M");
    const packed = JSON.stringify(feed);
    assert.equal(packed.includes("@"), false);
    assert.equal(packed.toLowerCase().includes("rate"), false);
    assert.equal(packed.toLowerCase().includes("minimum"), false);
    assert.equal(packed.includes("13-17"), false);
    assert.equal(packed.includes("Alex"), false);
    assert.equal(packed.includes("Kyler"), false);
    assert.match(source("src/app/api/roster/route.ts"), /publicRosterFeed/);
  });

  test("proof lists worked-with names and hides empty case studies", () => {
    assert.equal(visibleCaseStudies().length, 0);
    assert.equal(visibleTestimonials().length, 0);
    const page = source("src/app/work/page.tsx");
    assert.match(page, /visibleCaseStudies/);
    assert.match(page, /visibleTestimonials/);
    for (const brand of ["SHEIN", "Darry Ring", "Levoit", "CASETiFY", "Dreame", "JACKERY", "POP MART", "Anker", "MINISO", "celimax"]) {
      assert.equal(WORKED_WITH.includes(brand as (typeof WORKED_WITH)[number]), true);
    }
    assert.match(page, /WORKED_WITH/);
    assert.equal(page.includes(".png"), false);
    assert.equal(isPublicMarketingPath("/work", ""), true);
  });

  test("public portal copy is for applicants, and portal SEO is set", () => {
    const apply = source("src/app/apply/page.tsx");
    const thanks = source("src/app/apply/thanks/page.tsx");
    const inquire = source("src/app/inquire/page.tsx");
    assert.equal(apply.includes("Nothing is emailed from this form"), false);
    assert.equal(apply.includes("Kamron decides"), false);
    assert.match(apply, /5 business days/);
    assert.match(thanks, /Your application is under review/);
    assert.match(thanks, /5 business days/);
    assert.equal(inquire.includes("does not send an email"), false);
    assert.equal(inquire.includes("Kamron decides"), false);
    const meta = publicPageMeta({ title: "Work", description: "Brands we have worked with.", path: "/work" });
    assert.equal(meta.description, "Brands we have worked with.");
    const image = meta.openGraph && "images" in meta.openGraph ? meta.openGraph.images : null;
    const first = Array.isArray(image) ? image[0] : null;
    assert.equal(typeof first === "object" && first && "alt" in first ? first.alt : null, "Momma Mari");
    assert.match(source("src/app/sitemap.ts"), /PUBLIC_SITEMAP_PATHS/);
    assert.equal(source("src/lib/public-meta.ts").includes('"/privacy"'), true);
    assert.equal(source("src/lib/public-meta.ts").includes('"/work"'), true);
    assert.match(source("src/app/robots.ts"), /sitemap/);
    assert.match(source("src/components/meet-creators.tsx"), /alt=\{creator\.name\}/);
    assert.match(source("src/app/gifts/page.tsx"), /alt=\{offer\.product\}/);
    const services = source("src/app/services/page.tsx");
    assert.equal(services.includes("Sign your contract via DocuSign"), false);
  });

  test("usage and exclusivity dates raise a 14-day alert on the owner list", async () => {
    const quiet = await saveUsageRights(db, {
      dealId: "kosbling",
      startsOn: "2026-10-01",
      endsOn: "2026-12-15",
      exclusivityEndsOn: "2026-12-15",
      exclusivityCategory: "Doll kits",
      usageType: "organic",
      territory: "US",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(quiet.ok, true);
    const later = usageExpiryAlerts(await import("../src/lib/usage").then((mod) => mod.listUsageRights(db, admin, "2026-10-21")), "2026-10-21");
    assert.equal(later.some((alert) => alert.dealId === "kosbling"), false);

    const soon = await saveUsageRights(db, {
      dealId: "vev",
      startsOn: "2026-10-01",
      endsOn: "2026-11-04",
      exclusivityEndsOn: "2026-10-20",
      exclusivityCategory: "Gummies",
      usageType: "paid",
      actorEmail: admin.email,
      actorRole: "admin",
    });
    assert.equal(soon.ok, true);
    const { listUsageRights } = await import("../src/lib/usage");
    const cards = await listUsageRights(db, admin, "2026-10-21");
    const alerts = usageExpiryAlerts(cards, "2026-10-21");
    const usage = alerts.find((alert) => alert.dealId === "vev" && alert.kind === "usage");
    const exclusivity = alerts.find((alert) => alert.dealId === "vev" && alert.kind === "exclusivity");
    assert.equal(usage?.status, "soon");
    assert.equal(usage?.daysLeft, 14);
    assert.equal(exclusivity?.status, "expired");
    assert.match(source("src/app/dashboard/page.tsx"), /OwnerSignals/);
    assert.match(source("src/components/owner-signals.tsx"), /Rights expiring/);
    const blocked = await saveUsageRights(db, {
      dealId: "vev",
      startsOn: "2026-10-01",
      endsOn: "2026-11-04",
      actorEmail: mariclare.email,
      actorRole: "creator",
    });
    assert.equal(blocked.ok, false);
    const row = (await db.select().from(usageRights).where(eq(usageRights.dealId, "vev")))[0];
    assert.equal(row?.exclusivityCategory, "Gummies");
  });

  test("a brand report has a rebook link and no price while payments are off", async () => {
    assert.equal(paymentsEnabled(), false);
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const blocked = await openBrandReport(db, mariclare, "kosbling");
    assert.equal(blocked.ok, false);
    const opened = await openBrandReport(db, admin, "kosbling");
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const report = await publicBrandReport(db, opened.token);
    assert.equal(report?.brand, "KOSBLING");
    assert.equal(report?.rebookHref, "/inquire?with=mariclare");
    const packed = JSON.stringify(report);
    assert.equal(packed.includes("$"), false);
    assert.equal(packed.toLowerCase().includes("minimum"), false);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    assert.equal((await db.select().from(brandCampaignReports)).some((row) => row.dealId === "kosbling"), true);
    const page = source("src/app/brand-report/[token]/page.tsx");
    assert.match(page, /Rebook/);
    assert.match(page, /PAYMENTS_ENABLED/);
    assert.equal(page.includes("price_"), false);
    assert.equal(isPublicMarketingPath("/brand-report/abc", ""), true);
  });

  test("MariClare can accept, counter, or pass a deal and the owner sees it", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const offers = await listCreatorDealReviews(db, "mariclare");
    assert.equal(offers.length, 2);
    const persona = offers.find((offer) => offer.brand === "Persona");
    const bld = offers.find((offer) => offer.brand === "bld.co");
    assert.equal(persona?.contactEmail, "sameer@yourpersona.com");
    assert.equal(persona?.offerLabel, "$450 per post");
    assert.match(persona?.summary ?? "", /4 posts over 30 days/);
    assert.equal(bld?.contactEmail, "jamie@bld.co");
    assert.equal(bld?.offerLabel, "$2,000");
    assert.match(bld?.summary ?? "", /No usage/);
    assert.match(bld?.summary ?? "", /Net 30\/15/);
    const packed = JSON.stringify(offers);
    assert.equal(packed.toLowerCase().includes("minimum"), false);
    assert.equal(packed.includes("$1,000"), false);
    assert.equal(await creatorStartPath(db, mariclare), "/profile/intake");

    const stranger = await decideCreatorDealReview(db, {
      offerId: persona?.id ?? "",
      creatorId: "abby",
      actorRole: "creator",
      decision: "accept",
    });
    assert.equal(stranger.ok, false);
    const owner = await decideCreatorDealReview(db, {
      offerId: persona?.id ?? "",
      creatorId: null,
      actorRole: "admin",
      decision: "accept",
    });
    assert.equal(owner.ok, false);

    const accepted = await decideCreatorDealReview(db, {
      offerId: persona?.id ?? "",
      creatorId: mariclare.creatorId,
      actorRole: "creator",
      decision: "accept",
    });
    assert.equal(accepted.ok, true);
    const countered = await decideCreatorDealReview(db, {
      offerId: bld?.id ?? "",
      creatorId: mariclare.creatorId,
      actorRole: "creator",
      decision: "counter",
      note: "Can we start the week after next?",
    });
    assert.equal(countered.ok, true);
    const again = await decideCreatorDealReview(db, {
      offerId: persona?.id ?? "",
      creatorId: mariclare.creatorId,
      actorRole: "creator",
      decision: "pass",
    });
    assert.equal(again.ok, false);

    await db.insert(creatorOfferReviews).values({
      id: "review-pass",
      creatorId: "mariclare",
      brand: "Sample Pass",
      contactEmail: "hello@samplepass.test",
      offerLabel: "$300",
      summary: "One story set.",
      decision: null,
      counterNote: null,
      decidedAt: null,
      createdAt: "2026-10-21T12:00:00.000Z",
    });
    const passed = await decideCreatorDealReview(db, {
      offerId: "review-pass",
      creatorId: mariclare.creatorId,
      actorRole: "creator",
      decision: "pass",
    });
    assert.equal(passed.ok, true);
    assert.equal((await saveProfileIntake(db, mariclare, {
      legalName: "Mari Clare",
      phone: "9805550100",
      addressLine1: "1 Sample Street",
      addressLine2: "",
      city: "Charlotte",
      addressState: "NC",
      zip: "28202",
      country: "United States",
      handles: [{ platform: "TikTok", handle: "@mariclare", url: "", followers: "" }],
    })).ok, true);
    assert.equal(await creatorStartPath(db, mariclare), "/onboarding");

    const board = await listOwnerDealReviews(db, admin);
    assert.equal(board.ok, true);
    if (board.ok) {
      assert.equal(board.reviews.find((row) => row.brand === "Persona")?.decision, "accept");
      assert.equal(board.reviews.find((row) => row.brand === "bld.co")?.decision, "counter");
      assert.equal(board.reviews.find((row) => row.brand === "Sample Pass")?.decision, "pass");
    }
    const hidden = await listOwnerDealReviews(db, abby);
    assert.equal(hidden.ok, false);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const home = source("src/app/page.tsx");
    const offersPage = source("src/app/offers/page.tsx");
    const card = source("src/components/creator-deal-review.tsx");
    assert.equal(home.includes("CreatorDealReviewCard"), false);
    assert.match(home, /pendingReviews/);
    assert.match(offersPage, /CreatorDealReviewCard/);
    assert.match(card, /Needs your answer/);
    assert.match(card, /I&apos;m interested/);
    assert.match(card, /Suggest a counter/);
    assert.match(card, />Pass</);
    assert.equal(card.toLowerCase().includes("minimum"), false);
    assert.match(source("src/components/owner-signals.tsx"), /Creator decisions/);
    const migration = source("drizzle/0043_site_gap.sql");
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(/update\s+deals/i.test(migration), false);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.visibleToCreator, true);
  });
});
