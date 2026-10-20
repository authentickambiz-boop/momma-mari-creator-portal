import Link from "next/link";
import { redirect } from "next/navigation";
import { dismissCreatorNoticeAction, dismissNotificationAction } from "@/app/actions";
import { DealBoard } from "@/components/deal-board";
import { PlatformInviteCard } from "@/components/platform-invite-card";
import { PortalFrame } from "@/components/portal-frame";
import { dealPowers } from "@/lib/authz";
import { longDate } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";
import { countOwnPayouts, creatorHomeCards, creatorNeedsYou, firstName } from "@/lib/creator-home";
import { listManagerNotices, needsYou } from "@/lib/managers";
import { listUnreadNotices } from "@/lib/onboarding";
import { listUnreadCreatorNotices } from "@/lib/video-review";
import { getDealForViewer, listDealsForViewer } from "@/lib/queries";
import { listCreatorOffers } from "@/lib/brand-offers";
import { questionnaireFor } from "@/lib/questionnaire";
import { inviteErrorNote } from "@/lib/invite-notes";
import { noticeErrorNote } from "@/lib/notice-notes";
import { listPlatformInvites } from "@/lib/platform-invites";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ creator?: string; passed?: string; invite?: string; noticeError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const deals = await listDealsForViewer(portal.db, portal.viewer, portal.viewedId);
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
  const accountsConnected = Boolean(portal.viewed && Object.values(portal.viewed.accounts).some((account) => account.status === "connected"));
  const cards = creatorHome
    ? creatorHomeCards({ offersWaiting: creatorNeed.length, payoutsPending, accountsConnected })
    : [];
  const heading = portal.viewer.role === "manager"
    ? "My creators"
    : creatorHome && portal.viewed
      ? `Welcome, ${firstName(portal.viewed.name)}`
      : portal.viewed
        ? `Hi ${portal.viewed.name} 👋`
        : "All creators";
  const creatorNotices = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await listUnreadCreatorNotices(portal.db, portal.viewer.creatorId)
    : [];
  const quiz = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await questionnaireFor(portal.db, portal.viewer.creatorId)
    : null;
  const brandOffers = portal.viewer.role === "creator" ? await listCreatorOffers(portal.db, portal.viewer) : [];
  const platformInvites = creatorHome ? await listPlatformInvites(portal.db, portal.viewer) : [];
  const offersWaiting = brandOffers.filter((offer) => offer.response === "pending" || offer.response === "question");
  if (quiz && !quiz.finished && !quiz.paused) redirect("/onboarding");
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="deals"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
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
      {inviteErrorNote(params.invite) ? <p className="private-note">{inviteErrorNote(params.invite)}</p> : null}
      {params.noticeError ? <p className="note">{noticeErrorNote(params.noticeError) ?? "That notice was not dismissed. Nothing was changed."}</p> : null}
      {platformInvites.map((invite) => <PlatformInviteCard key={invite.id} invite={invite} />)}
      {offersWaiting.length > 0 ? (
        <div className="callout">
          <b>{offersWaiting.length === 1 ? "A brand offer is in your inbox." : `${offersWaiting.length} brand offers are in your inbox.`}</b>{" "}
          <Link href="/offers">Open offers</Link>
        </div>
      ) : null}
      {quiz && !quiz.finished ? (
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
            <Link key={card.title} href={card.href} className="home-card">
              <strong>{card.title}</strong>
              <span>{card.status}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {creatorHome && creatorNeed.length === 0 ? <p className="note">Nothing needs you this week.</p> : null}
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
        deals={deals}
        selected={selected}
        showDetail={false}
        listNote={portal.viewed?.listNote ?? null}
        creatorQuery={creatorQuery}
        {...dealPowers(portal.viewer)}
      />
      </div>
    </PortalFrame>
  );
}
