import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { GET as listCampaigns, POST as saveCampaign } from "../src/app/api/bot/campaigns/route";
import { GET as listInterest } from "../src/app/api/bot/campaigns/[id]/interest/route";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, benchCreators, commissionCampaignInterest, creators } from "../src/db/schema";
import {
  creatorIsOpenRoster,
  listBotCommissionCampaigns,
  listCommissionCampaignsForOwner,
  listCommissionInterest,
  listOpenCommissionCampaigns,
  saveCommissionCampaign,
  showCommissionInterest,
} from "../src/lib/commission-campaigns";
import { paymentsEnabled } from "../src/lib/payments";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import { getDealForViewer } from "../src/lib/queries";
import { abby, admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("commission campaigns", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("creators can show interest, the owner sees counts, and brand email stays off the card", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    assert.equal(paymentsEnabled(), false);

    const priced = await saveCommissionCampaign(db, {
      brand: "Priced Co",
      title: "No",
      description: "A paid post.",
      terms: "20% of sales",
      rateCents: 5000,
      contactEmail: "secret-brand@example.com",
    });
    assert.equal(priced.status, 400);

    const created = await saveCommissionCampaign(db, {
      id: "camp-cedar",
      brand: "Cedar Soap",
      title: "Affiliate wash",
      description: "Share a code. Commission only.",
      terms: "15% of sales for 30 days",
      contactEmail: "secret-brand@example.com",
    });
    assert.equal(created.status, 201);
    const campaign = (created.body as { campaign: { rate: string; trackingPending: boolean; bonusPending: boolean; status: string } }).campaign;
    assert.equal(campaign.rate, "TBD");
    assert.equal(campaign.trackingPending, true);
    assert.equal(campaign.bonusPending, true);
    assert.equal(campaign.status, "open");
    assert.equal(JSON.stringify(created.body).includes("secret-brand@example.com"), false);
    assert.equal(JSON.stringify(created.body).includes("5000"), false);

    const linked = await saveCommissionCampaign(db, {
      id: "camp-cedar",
      trackingLink: "https://cedarsoap.test/track",
      bonus: "pending",
      status: "open",
    });
    assert.equal(linked.status, 200);
    const updated = (linked.body as { campaign: { trackingLink: string | null; trackingPending: boolean; bonusPending: boolean; title: string } }).campaign;
    assert.equal(updated.trackingLink, "https://cedarsoap.test/track");
    assert.equal(updated.trackingPending, false);
    assert.equal(updated.bonusPending, true);
    assert.equal(updated.title, "Affiliate wash");

    const closed = await saveCommissionCampaign(db, {
      id: "camp-closed",
      brand: "Closed Co",
      title: "Ended",
      description: "This one is closed.",
      terms: "10% of sales",
      status: "closed",
    });
    assert.equal(closed.status, 201);

    await db.update(creators).set({ contracted: true }).where(eq(creators.id, "abby"));
    await db.insert(benchCreators).values({
      id: "bench-abby",
      name: "Abby Theriot",
      email: abby.email,
      slug: "abby-bench",
      nichesJson: "[]",
      platformsJson: "[]",
      portfolioJson: "[]",
      score: null,
      status: "bench",
      creatorId: "abby",
      createdAt: "2026-10-21T00:00:00.000Z",
      promotedAt: null,
    });
    assert.equal(await creatorIsOpenRoster(db, "mariclare"), true);
    assert.equal(await creatorIsOpenRoster(db, "abby"), true);

    const abbyBoard = await listOpenCommissionCampaigns(db, abby);
    assert.equal(abbyBoard.some((item) => item.id === "camp-cedar"), true);
    const mari = await listOpenCommissionCampaigns(db, mariclare);
    assert.equal(mari.some((item) => item.id === "camp-cedar"), true);
    assert.equal(mari.some((item) => item.id === "camp-closed"), false);
    assert.equal(JSON.stringify(mari).includes("secret-brand@example.com"), false);
    assert.equal(JSON.stringify(mari).toLowerCase().includes("minimum"), false);

    const first = await showCommissionInterest(db, mariclare, "camp-cedar");
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.already, false);
    const again = await showCommissionInterest(db, mariclare, "camp-cedar");
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.already, true);
    assert.equal((await db.select().from(commissionCampaignInterest)).length, 1);
    const denied = await showCommissionInterest(db, admin, "camp-cedar");
    assert.equal(denied.ok, false);
    const shut = await showCommissionInterest(db, abby, "camp-closed");
    assert.equal(shut.ok, false);

    await db.insert(commissionCampaignInterest).values({
      id: "interest-abby",
      campaignId: "camp-cedar",
      creatorId: "abby",
      createdAt: "2026-10-21T15:00:00.000Z",
    });
    await db.update(commissionCampaignInterest).set({ createdAt: "2026-10-20T12:00:00.000Z" }).where(eq(commissionCampaignInterest.creatorId, "mariclare"));

    const owner = await listCommissionCampaignsForOwner(db, admin);
    assert.equal(owner.ok, true);
    if (owner.ok) {
      const card = owner.campaigns.find((item) => item.id === "camp-cedar");
      assert.equal(card?.interestCount, 2);
      assert.equal(card?.rate, "TBD");
      assert.equal(owner.campaigns.some((item) => item.id === "camp-closed"), true);
    }
    assert.equal((await listCommissionCampaignsForOwner(db, mariclare)).ok, false);

    const all = await listCommissionInterest(db, "camp-cedar", null);
    assert.equal(all.status, 200);
    const everyone = (all.body as { interest: { creatorId: string }[] }).interest;
    assert.equal(everyone.length, 2);
    const recent = await listCommissionInterest(db, "camp-cedar", "2026-10-21T00:00:00.000Z");
    const since = (recent.body as { interest: { creatorId: string; email: string }[] }).interest;
    assert.deepEqual(since.map((row) => row.creatorId), ["abby"]);
    assert.equal(since[0]?.email, abby.email);
    const badSince = await listCommissionInterest(db, "camp-cedar", "October");
    assert.equal(badSince.status, 400);
    const missing = await listCommissionInterest(db, "nope", null);
    assert.equal(missing.status, 404);

    const botList = await listBotCommissionCampaigns(db);
    assert.equal((botList.body as { campaigns: { id: string }[] }).campaigns.some((item) => item.id === "camp-closed"), true);
    assert.equal(JSON.stringify(botList.body).includes("secret-brand@example.com"), false);

    const noToken = await listCampaigns(new Request("http://localhost/api/bot/campaigns"));
    assert.equal(noToken.status, 401);
    const noWrite = await saveCampaign(new Request("http://localhost/api/bot/campaigns", { method: "POST", body: "{}" }));
    assert.equal(noWrite.status, 401);
    const noInterest = await listInterest(new Request("http://localhost/api/bot/campaigns/camp-cedar/interest"), { params: Promise.resolve({ id: "camp-cedar" }) });
    assert.equal(noInterest.status, 401);

    const page = source("src/app/commission/page.tsx");
    const board = source("src/app/dashboard/page.tsx");
    assert.match(page, /Show interest/);
    assert.match(page, /free bench/);
    assert.equal(page.includes("contactEmail"), false);
    assert.equal(/\$\s?\d/.test(page), false);
    assert.match(board, /Commission campaigns/);
    assert.match(source("src/app/api/bot/campaigns/route.ts"), /botGuard/);
    assert.match(source("src/app/api/bot/campaigns/route.ts"), /export async function POST/);
    assert.match(source("src/app/api/bot/campaigns/route.ts"), /export async function GET/);
    assert.match(source("src/app/api/bot/campaigns/[id]/interest/route.ts"), /since/);
    const sql = source("drizzle/0052_commission_campaigns.sql");
    assert.equal(sql.toLowerCase().includes("drop"), false);
    assert.equal(sql.toLowerCase().includes("delete"), false);
    assert.match(sql, /KOSBLING/);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.label === "Commission"), true);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.label === "Campaigns"), false);
    assert.equal(visiblePortalTabs(admin).some((tab) => tab.label === "Commission"), true);

    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
  });
});
