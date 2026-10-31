import Link from "next/link";
import { redirect } from "next/navigation";
import { dismissCreatorNoticeAction, dismissNotificationAction } from "@/app/actions";
import { CheckoutSuccessNote } from "@/components/checkout-success-note";
import { DealBoard } from "@/components/deal-board";
import { HomeDesk } from "@/components/home-desk";
import { PlatformInviteCard } from "@/components/platform-invite-card";
import { PortalFrame } from "@/components/portal-frame";
import { dealPowers } from "@/lib/authz";
import { longDate } from "@/lib/format";
import { currentViewer, loadPortal } from "@/lib/current-user";
import { creatorIsFree } from "@/lib/account-tier";
import { welcomeChecklist } from "@/lib/welcome-checklist";
import { dismissChecklistAction } from "@/app/free-actions";
import { ensureInviteCode } from "@/lib/signup-codes";
import { analyticsBoard, withJulyHeadline } from "@/lib/analytics-snapshots";
import { countOwnPayouts, creatorBrandDealNeedsAction, creatorHomeCards, creatorNeedsYou, firstName } from "@/lib/creator-home";
import { listManagerNotices, needsYou } from "@/lib/managers";
import { listUnreadNotices } from "@/lib/onboarding";
import { listUnreadCreatorNotices } from "@/lib/video-review";
import { getDealForViewer, listDealsForViewer } from "@/lib/queries";
import { listCreatorOffers } from "@/lib/brand-offers";
import { CreatorTodos } from "@/components/creator-todos";
import { CREATOR_REVIEW_EMPTY, creatorReviewNeedsAction, listCreatorDealReviews } from "@/lib/creator-deal-review";
import { listCreatorOpenTasks } from "@/lib/creator-tasks";
import { ensureCreatorDeposits, ensureOpenDeposits } from "@/lib/brand-deposits";
import { questionnaireFor } from "@/lib/questionnaire";
import { inviteErrorNote } from "@/lib/invite-notes";
import { noticeErrorNote } from "@/lib/notice-notes";
import { countDealInbox } from "@/lib/gmail-bridge";
import { listPlatformInvites } from "@/lib/platform-invites";
import { SeasonalGreeting } from "@/components/seasonal-greeting";
import { promoViewsForDeals } from "@/lib/promo-visuals";

const TODO_NOTES: Record<string, string> = {
  done: "Marked done.",
  missing: "That to-do is not on your list.",
  own: "You can only update your own to-dos.",
  role: "You can't update this to-do.",
  "1": "That to-do was not saved.",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ creator?: string; passed?: string; invite?: string; noticeError?: string; checkout?: string; todo?: string }> }) {
  const params = await searchParams;
  if (!(await currentViewer())) redirect("/login?next=/");
  const portal = await loadPortal(params.creator ?? null);
  const freeHome = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await creatorIsFree(portal.db, portal.viewer.creatorId)
    : false;
  const checklist = freeHome && portal.viewer.creatorId ? await welcomeChecklist(portal.db, portal.viewer.creatorId) : null;
  const inviteCode = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await ensureInviteCode(portal.db, portal.viewer.creatorId)
    : null;
  if (portal.viewer.role === "admin") await ensureOpenDeposits(portal.db);
  else if (portal.viewer.creatorId) await ensureCreatorDeposits(portal.db, portal.viewer.creatorId);
  else if (portal.viewedId && portal.viewedId !== "all") await ensureCreatorDeposits(portal.db, portal.viewedId);
  const deals = await listDealsForViewer(portal.db, portal.viewer, portal.viewedId);
  const visuals = await promoViewsForDeals(portal.db, deals);
  const fallback = deals.find((deal) => deal.id === "vev")?.id ?? deals[0]?.id;
  const selected = fallback ? await getDealForViewer(portal.db, portal.viewer, fallback) : null;
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  const creatorQuery = staff ? `?creator=${portal.viewedId}` : "";
  const visible = deals.filter((deal) => deal.visibleToCreator && deal.status !== "paid");
  const need = deals.filter((deal) => deal.visibleToCreator && deal.needsCreator);
  const hidden = deals.filter((deal) => !deal.visibleToCreator);
  const notices = portal.viewer.role === "admin" ? await listUnreadNotices(portal.db) : [];
  const managerNotices = portal.viewer.role === "manager" && portal.viewer.managerId
    ? await listManagerNotices(portal.db, portal.viewer.managerId)
    : [];
  const waiting = portal.viewer.role === "manager" ? await needsYou(portal.db, portal.viewer) : [];
  const creatorHome = portal.viewer.role === "creator" && Boolean(portal.viewed);
  const creatorNeed = creatorHome ? creatorNeedsYou(deals) : [];
  const payoutsPending = creatorHome && portal.viewer.creatorId ? await countOwnPayouts(portal.db, portal.viewer.creatorId) : 0;
  const homeStats = creatorHome
    ? withJulyHeadline(
        (await analyticsBoard(portal.db, portal.viewer)).creators.find((row) => row.creatorId === portal.viewed?.id)
        ?? { largestPlatform: null, platforms: [] },
      ).cards
    : [];
  const inboxThreads = creatorHome && portal.viewer.creatorId
    ? await countDealInbox(portal.db, portal.viewer, portal.viewer.creatorId)
    : 0;
  const cards = creatorHome
    ? creatorHomeCards({ offersWaiting: creatorNeed.length, payoutsPending, stats: homeStats, inboxThreads })
    : [];
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const dayHello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const heading = portal.viewer.role === "manager" && !portal.viewed
    ? "My creators"
    : portal.viewed
      ? `${dayHello}, ${firstName(portal.viewed.name)}`
      : "All creators";
  const needDeals = creatorHome
    ? deals.filter((deal) => creatorNeed.some((item) => item.id === deal.id))
    : portal.viewed
      ? need
      : [];
  const creatorNotices = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await listUnreadCreatorNotices(portal.db, portal.viewer.creatorId)
    : [];
  const quiz = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await questionnaireFor(portal.db, portal.viewer.creatorId)
    : null;
  const brandOffers = portal.viewer.role === "creator" ? await listCreatorOffers(portal.db, portal.viewer) : [];
  const platformInvites = creatorHome ? await listPlatformInvites(portal.db, portal.viewer) : [];
  const dealReviews = creatorHome && portal.viewer.creatorId
    ? await listCreatorDealReviews(portal.db, portal.viewer.creatorId)
    : [];
  const openTasks = creatorHome && portal.viewer.creatorId
    ? await listCreatorOpenTasks(portal.db, portal.viewer.creatorId)
    : [];
  const todoNote = params.todo ? TODO_NOTES[params.todo] ?? TODO_NOTES["1"] : null;
  const offersWaiting = brandOffers.filter((offer) => offer.response === "pending" || offer.response === "question");
  const reviewWaiting = dealReviews.filter(creatorReviewNeedsAction);
  const pendingReviews = dealReviews.some((offer) => !offer.decision);
  const actionDeals = creatorHome ? deals.filter(creatorBrandDealNeedsAction) : deals;
  if (!freeHome && quiz && !quiz.finished && !quiz.paused && !pendingReviews) {
    redirect(params.checkout === "success" ? "/onboarding?checkout=success" : "/onboarding");
  }
  const noDeals = portal.viewer.role === "creator" && deals.length === 0;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="deals"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            {creatorHome ? <SeasonalGreeting /> : null}
            <h1>{heading}</h1>
            <p>
              {portal.viewed
                ? `${longDate(new Date())} · ${visible.length} deals in progress · ${need.length} need you this week${hidden.length ? ` · ${hidden.length} hidden from ${portal.viewed.name}` : ""}`
                : `${deals.length} deals across the roster`}
            </p>
          </div>
        </div>
      }
    >
      <CheckoutSuccessNote checkout={params.checkout} />
      {noDeals ? (
        <p className="note empty" data-empty-deals="true">You have no deals yet. Check back daily, or browse our <Link href="/commission">commission-only section</Link>.</p>
      ) : null}
      {freeHome ? (
        <div className="card stack" style={{ marginBottom: 14 }}>
          <h2>Your free account</h2>
          <p><Link href="/apply">Apply for management</Link> or <Link href="/pricing">see Plus $19/mo, Pro $39/mo, and Business $199/mo</Link>. One-time services run from $79 to $499.</p>
        </div>
      ) : null}
      {checklist && !checklist.dismissed ? (
        <section className="card stack" data-welcome-checklist="true" style={{ marginBottom: 14 }}>
          <h2>Welcome checklist</h2>
          <ul>
            {checklist.items.map((item) => (
              <li key={item.id}>{item.done ? "Done" : "Open"} · <Link href={item.href}>{item.label}</Link></li>
            ))}
          </ul>
          {checklist.complete ? (
            <form action={dismissChecklistAction}><button className="btn ghost" type="submit">Dismiss checklist</button></form>
          ) : null}
        </section>
      ) : null}
      {inviteCode && !inviteCode.disabledAt ? (
        <p className="note">Your invite code is <b>{inviteCode.code}</b>. Share it with someone starting a free account. {inviteCode.useCount} of {inviteCode.usageCap} uses.</p>
      ) : null}
      {inviteErrorNote(params.invite) ? <p className="private-note">{inviteErrorNote(params.invite)}</p> : null}
      {params.noticeError ? <p className="note alert" role="alert">{noticeErrorNote(params.noticeError) ?? "That notice was not dismissed. Nothing was changed."}</p> : null}
      {platformInvites.map((invite) => <PlatformInviteCard key={invite.id} invite={invite} />)}
      {creatorHome && !freeHome ? <CreatorTodos tasks={openTasks} note={todoNote} /> : null}
      {creatorHome && offersWaiting.length + reviewWaiting.length > 0 ? (
        <div className="callout">
          <b>{offersWaiting.length + reviewWaiting.length === 1 ? "A brand offer is in your inbox." : `${offersWaiting.length + reviewWaiting.length} brand offers are in your inbox.`}</b>{" "}
          <Link href="/offers">Open offers</Link>
        </div>
      ) : null}
      {!freeHome && quiz && !quiz.finished ? (
        <div className="callout">
          <b>Finish your setup.</b> Your answers match brand deals and fill in your profile. <Link href="/onboarding">Continue</Link>
        </div>
      ) : null}
      {params.passed === "1" && portal.viewer.role === "creator" ? (
        <div className="callout">
          <b>You passed on that offer.</b> It is off your list. Kamron has a polite note to the brand waiting for his OK. Nothing goes out until he approves it.
        </div>
      ) : null}
      {creatorNotices.map((notice) => (
        <div className="callout" key={notice.id}>
          <b>{notice.message}</b>
          <form action={dismissCreatorNoticeAction} style={{ display: "inline", marginLeft: 10 }}>
            <input type="hidden" name="id" value={notice.id} />
            <button className="btn ghost" type="submit">Dismiss</button>
          </form>
        </div>
      ))}
      {cards.length > 0 ? (
        <div className="home-cards">
          {cards.map((card) => (
            <Link key={`${card.href}|${card.title}|${card.status}`} href={card.href} className="home-card">
              <strong>{card.title}</strong>
              <span>{card.status}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {portal.viewed ? (
        <HomeDesk
          deals={creatorHome ? actionDeals : deals}
          needs={creatorHome ? actionDeals : needDeals}
          payoutPending={payoutsPending}
          assistant={selected?.nextStep ?? null}
        />
      ) : null}
      {creatorHome && creatorNeed.length === 0 ? <p className="note empty">Nothing needs you this week.</p> : null}
      {creatorNeed.length > 0 ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-title">Needs you</div>
          <ul className="timeline">
            {creatorNeed.map((item) => (
              <li key={item.id}>
                <Link href={item.href}><b>{item.title}</b></Link>
                <div className="note">{item.detail}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {waiting.length > 0 ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-title">Needs you</div>
          <ul className="timeline">
            {waiting.map((item) => (
              <li key={item.id}>
                <Link href={item.href}><b>{item.title}</b></Link>
                <div className="note">{item.detail}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {managerNotices.map((notice) => (
        <div className="admin-banner" key={notice.id}>
          <b>{notice.message}</b>
          {" "}· {notice.creatorName}
          <form action={dismissNotificationAction} style={{ display: "inline", marginLeft: 10 }}>
            <input type="hidden" name="id" value={notice.id} />
            <button className="btn ghost" type="submit">Dismiss</button>
          </form>
        </div>
      ))}
      {notices.map((notice) => (
        <div className="admin-banner" key={notice.id}>
          <b>{notice.message}</b>
          {" "}· {notice.creatorName}
          <form action={dismissNotificationAction} style={{ display: "inline", marginLeft: 10 }}>
            <input type="hidden" name="id" value={notice.id} />
            <button className="btn ghost" type="submit">Dismiss</button>
          </form>
        </div>
      ))}
      <div id="deals">
      <DealBoard
        deals={creatorHome ? actionDeals : deals}
        selected={selected}
        showDetail={false}
        listNote={portal.viewed?.listNote ?? null}
        creatorQuery={creatorQuery}
        emptyCopy={creatorHome ? CREATOR_REVIEW_EMPTY : null}
        visuals={visuals}
        {...dealPowers(portal.viewer)}
      />
      </div>
    </PortalFrame>
  );
}
