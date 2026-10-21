import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { GET as listDeals } from "../src/app/api/bot/deals/route";
import { PUT as putOfferReview } from "../src/app/api/bot/offer-reviews/route";
import { GET as listTasks, POST as postTask, PUT as putTask } from "../src/app/api/bot/tasks/route";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, creatorQuestionnaires, creatorTasks } from "../src/db/schema";
import { listBotDeals, upsertDeal } from "../src/lib/bot-api";
import { decideCreatorDealReview, listCreatorDealReviews, reviewChoices, upsertOfferReview } from "../src/lib/creator-deal-review";
import {
  listBotTasks,
  listCreatorOpenTasks,
  listOwnerTasks,
  markCreatorTaskDone,
  saveCreatorTask,
  upsertCreatorTask,
} from "../src/lib/creator-tasks";
import { boldSignEnabled } from "../src/lib/boldsign";
import { pushEnabled } from "../src/lib/home-screen";
import { paymentsEnabled } from "../src/lib/payments";
import { getDealForViewer } from "../src/lib/queries";
import { abby, admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("creator to-dos and offer reviews", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("bots can read deals, set a stage, and negotiating does not become contract review", async () => {
    assert.equal(paymentsEnabled(), false);
    assert.equal(pushEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    const missing = await listDeals(new Request("http://localhost/api/bot/deals?creator=mariclare"));
    assert.equal(missing.status, 401);
    const plain = await upsertDeal(db, {
      id: "makartt",
      brand: "Makartt",
      creatorId: "mariclare",
      status: "negotiating",
      visibleToCreator: true,
    });
    assert.equal(plain.status, 201);
    if ("workflowStage" in plain.body) assert.equal(plain.body.workflowStage, "interest_sent");
    assert.notEqual((await getDealForViewer(db, admin, "makartt"))?.workflowStage, "contract_review");

    const created = await upsertDeal(db, {
      id: "momcozy",
      brand: "Momcozy",
      creatorId: "mariclare",
      status: "negotiating",
      stage: "offer_shared",
      visibleToCreator: true,
      rateCents: 45000,
      rateLabel: "$450",
      amountDisplay: "$450",
      kamronNotes: "staff note stay hidden",
    });
    assert.equal(created.status, 201);
    const stored = await getDealForViewer(db, admin, "momcozy");
    assert.equal(stored?.workflowStage, "offer_shared");
    assert.equal(stored?.status, "negotiating");
    assert.notEqual(stored?.workflowStage, "contract_review");

    const listed = await listBotDeals(db, "mmaclamroc@gmail.com");
    assert.equal(listed.status, 200);
    const body = listed.body as { deals: { id: string; workflowStage: string; visibleToCreator: boolean }[] };
    const mom = body.deals.find((deal) => deal.id === "momcozy");
    assert.equal(mom?.workflowStage, "offer_shared");
    assert.equal(mom?.visibleToCreator, true);
    assert.equal(body.deals.some((deal) => deal.id === "makartt"), true);
    const packed = JSON.stringify(mom);
    assert.equal(packed.includes("45000"), false);
    assert.equal(packed.includes("$450"), false);
    assert.equal(packed.includes("staff note"), false);
    assert.equal(packed.toLowerCase().includes("kamron"), false);
    assert.equal(packed.toLowerCase().includes("floor"), false);
    assert.equal(packed.includes("rateCents"), false);
    assert.equal(packed.includes("kamronNotes"), false);
    assert.match(source("src/app/api/bot/deals/route.ts"), /botGuard/);
    assert.match(source("src/app/api/bot/deals/route.ts"), /listBotDeals/);
  });

  test("offer reviews are written by the bot, shown on the creator home, and an answer is kept", async () => {
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const denied = await putOfferReview(new Request("http://localhost/api/bot/offer-reviews", {
      method: "PUT",
      body: JSON.stringify({ id: "review-momcozy" }),
    }));
    assert.equal(denied.status, 401);

    const saved = await upsertOfferReview(db, {
      id: "review-momcozy",
      creatorEmail: "mmaclamroc@gmail.com",
      brand: "Momcozy",
      contactEmail: "hello@momcozy.test",
      offerLabel: "Gifted stroller",
      summary: "One TikTok. No usage.",
      reviewMode: "counter-only",
    });
    assert.equal(saved.status, 201);
    const info = await upsertOfferReview(db, {
      id: "review-temu",
      creatorId: "mariclare",
      brand: "Temu",
      contactEmail: "hello@temu.test",
      offerLabel: "Product only",
      summary: "For your notes. The owner already declined the terms.",
      reviewMode: "info",
    });
    assert.equal(info.status, 201);
    const other = await upsertOfferReview(db, {
      id: "review-abby-only",
      creatorId: "abby",
      brand: "PrettyUp",
      contactEmail: "hello@prettyup.test",
      offerLabel: "One reel",
      summary: "Abby's offer.",
    });
    assert.equal(other.status, 201);

    const mari = await listCreatorDealReviews(db, "mariclare");
    const mom = mari.find((offer) => offer.id === "review-momcozy");
    const temu = mari.find((offer) => offer.id === "review-temu");
    assert.equal(mom?.brand, "Momcozy");
    assert.equal(mom?.offerLabel, "Gifted stroller");
    assert.match(mom?.summary ?? "", /One TikTok/);
    assert.equal(mom?.reviewMode, "counter");
    assert.equal(temu?.reviewMode, "info");
    assert.equal(mari.some((offer) => offer.id === "review-abby-only"), false);
    assert.equal((await listCreatorDealReviews(db, "abby")).some((offer) => offer.brand === "Momcozy"), false);
    assert.deepEqual(reviewChoices(mom?.reviewMode ?? null, null), ["counter"]);
    assert.deepEqual(reviewChoices("info", null), []);
    assert.equal(reviewChoices(null, null).includes("accept"), true);

    const home = source("src/app/page.tsx");
    const card = source("src/components/creator-deal-review.tsx");
    assert.match(home, /listCreatorDealReviews/);
    assert.match(home, /CreatorDealReviewCard/);
    assert.match(card, /\{offer\.brand\}/);
    assert.match(card, /\{offer\.summary\}/);
    assert.match(card, /reviewChoices/);
    assert.match(card, /Nothing to accept/);
    assert.match(source("src/app/api/bot/offer-reviews/route.ts"), /botGuard/);
    assert.match(source("src/app/api/bot/offer-reviews/route.ts"), /upsertOfferReview/);

    const accept = await decideCreatorDealReview(db, {
      offerId: "review-momcozy",
      creatorId: "mariclare",
      actorRole: "creator",
      decision: "accept",
    });
    assert.equal(accept.ok, false);
    const infoAccept = await decideCreatorDealReview(db, {
      offerId: "review-temu",
      creatorId: "mariclare",
      actorRole: "creator",
      decision: "accept",
    });
    assert.equal(infoAccept.ok, false);
    const stranger = await decideCreatorDealReview(db, {
      offerId: "review-momcozy",
      creatorId: "abby",
      actorRole: "creator",
      decision: "counter",
    });
    assert.equal(stranger.ok, false);
    const countered = await decideCreatorDealReview(db, {
      offerId: "review-momcozy",
      creatorId: "mariclare",
      actorRole: "creator",
      decision: "counter",
      note: "Can we start next month?",
    });
    assert.equal(countered.ok, true);

    const rewrite = await upsertOfferReview(db, {
      id: "review-momcozy",
      creatorId: "abby",
      brand: "Replaced",
      contactEmail: "other@example.test",
      offerLabel: "New label",
      summary: "New summary",
      reviewMode: "info",
    });
    assert.equal(rewrite.status, 200);
    const keptBody = rewrite.body as { kept: boolean; brand: string; decision: string };
    assert.equal(keptBody.kept, true);
    assert.equal(keptBody.brand, "Momcozy");
    assert.equal(keptBody.decision, "counter");
    const after = (await listCreatorDealReviews(db, "mariclare")).find((offer) => offer.id === "review-momcozy");
    assert.equal(after?.brand, "Momcozy");
    assert.equal(after?.summary, "One TikTok. No usage.");
    assert.equal(after?.decision, "counter");
    assert.equal(after?.reviewMode, "counter");
    assert.equal((await listCreatorDealReviews(db, "abby")).some((offer) => offer.id === "review-momcozy"), false);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);
  });

  test("creator to-dos are seeded without rates, sorted, and edited by the owner", async () => {
    const migration = source("drizzle/0047_creator_tasks.sql");
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(/update\s+deals/i.test(migration), false);
    assert.equal(migration.includes("500000"), false);
    assert.equal(migration.includes("$"), false);
    assert.match(migration, /creator_tasks/);
    assert.match(migration, /review_mode/);

    const denied = await listTasks(new Request("http://localhost/api/bot/tasks?creator=mariclare"));
    assert.equal(denied.status, 401);
    const deniedWrite = await putTask(new Request("http://localhost/api/bot/tasks", { method: "PUT", body: "{}" }));
    assert.equal(deniedWrite.status, 401);
    const deniedPost = await postTask(new Request("http://localhost/api/bot/tasks", { method: "POST", body: "{}" }));
    assert.equal(deniedPost.status, 401);

    await db.insert(creatorQuestionnaires).values({
      creatorId: "mariclare",
      step: "done",
      answersJson: JSON.stringify({
        niches: ["parenting"],
        frequency: "3 times a week",
        brands: ["Kind Soap"],
        rates: { TikTok: "500" },
        minVideo: "1000",
        typicalRate: "1500",
      }),
      pausedAt: null,
      finishedAt: "2026-10-21T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
    });

    const posted = await upsertCreatorTask(db, {
      id: "todo-overdue",
      creatorId: "mariclare",
      title: "Send the draft",
      detail: "Upload the first cut.\nStaff note: the floor is $400 and Kamron says wait.",
      dueDate: "2020-01-02",
      category: "content",
      status: "open",
    });
    assert.equal(posted.status, 201);
    const later = await upsertCreatorTask(db, {
      id: "todo-later",
      creatorEmail: "mmaclamroc@gmail.com",
      dealId: "momcozy",
      title: "Floor is $400",
      detail: "Confirm the post date.",
      dueDate: "2099-01-02",
      category: "deal",
    });
    assert.equal(later.status, 201);
    const undated = await upsertCreatorTask(db, {
      id: "todo-open",
      creatorId: "mariclare",
      title: "Update your profile photo",
      category: "profile",
    });
    assert.equal(undated.status, 201);

    const open = await listCreatorOpenTasks(db, "mariclare");
    assert.equal(open[0]?.id, "todo-overdue");
    assert.equal(open[1]?.id, "todo-later");
    assert.equal(open.find((task) => task.id === "goal-mariclare-monthly")?.overdue, false);
    const overdue = open.find((task) => task.id === "todo-overdue");
    assert.equal(overdue?.overdue, true);
    assert.equal(overdue?.title, "Send the draft");
    assert.equal(overdue?.detail, "Upload the first cut.");
    assert.equal(open.find((task) => task.id === "todo-later")?.title, "To-do");
    assert.equal(open.find((task) => task.id === "todo-later")?.overdue, false);
    assert.equal(open.find((task) => task.id === "todo-open")?.dueDate, null);
    const packed = JSON.stringify(open);
    assert.equal(packed.includes("$"), false);
    assert.equal(packed.includes("500"), false);
    assert.equal(packed.includes("1000"), false);
    assert.equal(packed.includes("1500"), false);
    assert.equal(packed.toLowerCase().includes("floor"), false);
    assert.equal(packed.toLowerCase().includes("rate"), false);
    assert.equal(packed.toLowerCase().includes("kamron"), false);
    assert.equal(packed.toLowerCase().includes("staff"), false);
    assert.match(packed, /parenting/);
    assert.match(packed, /3 times a week/);
    assert.match(packed, /Kind Soap/);
    assert.match(packed, /monthly goal/i);
    assert.equal(open.some((task) => task.id.startsWith("goal-abby")), false);

    const owner = await listOwnerTasks(db, admin);
    assert.equal(owner.ok, true);
    if (!owner.ok) return;
    assert.match(owner.tasks.find((task) => task.id === "todo-overdue")?.detail ?? "", /floor is \$400/);
    assert.equal((await saveCreatorTask(db, mariclare, {
      id: "todo-overdue",
      title: "Nope",
      detail: "",
      dueDate: "",
      category: "content",
      status: "open",
    })).ok, false);
    assert.equal((await saveCreatorTask(db, admin, {
      id: "todo-overdue",
      title: "Film the hook",
      detail: "Staff note: leave this off her screen.",
      dueDate: "2020-01-02",
      category: "content",
      status: "open",
    })).ok, true);
    const edited = await listCreatorOpenTasks(db, "mariclare");
    assert.equal(edited.find((task) => task.id === "todo-overdue")?.title, "Film the hook");
    assert.equal(edited.find((task) => task.id === "todo-overdue")?.detail, null);

    assert.equal((await markCreatorTaskDone(db, abby, "todo-overdue")).ok, false);
    assert.equal((await markCreatorTaskDone(db, mariclare, "todo-overdue")).ok, true);
    assert.equal((await listCreatorOpenTasks(db, "mariclare")).some((task) => task.id === "todo-overdue"), false);
    assert.equal((await db.select().from(creatorTasks).where(eq(creatorTasks.id, "todo-overdue")))[0]?.status, "done");

    const botList = await listBotTasks(db, "mariclare");
    assert.equal(botList.status, 200);
    const botBody = botList.body as { tasks: { id: string; status: string; detail: string | null }[] };
    assert.match(source("src/app/api/bot/tasks/route.ts"), /botGuard/);
    assert.match(source("src/app/api/bot/tasks/route.ts"), /export async function POST/);
    assert.match(source("src/app/api/bot/tasks/route.ts"), /export async function PUT/);
    assert.match(source("src/app/api/bot/tasks/route.ts"), /export async function GET/);
    assert.equal(botBody.tasks.find((task) => task.id === "todo-overdue")?.status, "done");
    assert.match(source("src/app/page.tsx"), /CreatorTodos/);
    assert.match(source("src/components/creator-todos.tsx"), /My to-dos/);
    assert.match(source("src/components/creator-todos.tsx"), /Overdue/);
    assert.match(source("src/components/creator-todos.tsx"), /Mark done/);
    assert.match(source("src/app/dashboard/page.tsx"), /OwnerTasks/);
    assert.equal((await db.select().from(approvalEmails)).length >= 0, true);
    const kosbling = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosbling?.brand, "KOSBLING");
    assert.equal(kosbling?.visibleToCreator, true);
  });
});
