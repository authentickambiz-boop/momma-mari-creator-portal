import { dismissCreatorNoticeAction } from "@/app/actions";
import { setCategoryOverrideAction } from "@/app/rules-actions";
import { DealBoard } from "@/components/deal-board";
import { PortalFrame } from "@/components/portal-frame";
import { dealPowers } from "@/lib/authz";
import { formatMoney, longDate } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";
import { getDealForViewer, listDealsForViewer } from "@/lib/queries";
import { categoryOverrideFor, screeningForDeal } from "@/lib/deal-rules";
import { rulesErrorNote } from "@/lib/rules-notes";
import { listUnreadCreatorNotices } from "@/lib/video-review";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creator?: string; stageError?: string; interestError?: string; releaseError?: string; reviewError?: string; contractError?: string; signed?: string; productError?: string; postError?: string; paymentError?: string; safetyError?: string; reply?: string; replyError?: string; rate?: string; rateError?: string; dates?: string; datesError?: string; saved?: string; rulesError?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(query.creator ?? null);
  const creatorNotices = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await listUnreadCreatorNotices(portal.db, portal.viewer.creatorId)
    : [];
  const deals = await listDealsForViewer(portal.db, portal.viewer, portal.viewedId);
  const selected = await getDealForViewer(portal.db, portal.viewer, id);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  const creatorQuery = staff ? `?creator=${portal.viewedId}` : "";
  const visible = deals.filter((deal) => deal.visibleToCreator && deal.status !== "paid");
  const need = deals.filter((deal) => deal.visibleToCreator && deal.needsCreator);
  const hidden = deals.filter((deal) => !deal.visibleToCreator);
  const screening = selected ? await screeningForDeal(portal.db, portal.viewer, selected.id) : null;
  const categoryOverride = selected && portal.viewer.role === "admin" ? await categoryOverrideFor(portal.db, selected.id) : false;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="deals"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>{portal.viewer.role === "manager" ? "My creators" : portal.viewed ? `Hi ${portal.viewed.name} 👋` : "All creators"}</h1>
            <p>
              {portal.viewed
                ? `${longDate(new Date())} · ${visible.length} deals in progress · ${need.length} need you this week${hidden.length ? ` · ${hidden.length} hidden from ${portal.viewed.name}` : ""}`
                : `${deals.length} deals across the roster`}
            </p>
          </div>
        </div>
      }
    >
      {creatorNotices.map((notice) => (
        <div className="callout" key={notice.id}>
          <b>{notice.message}</b>
          <form action={dismissCreatorNoticeAction} style={{ display: "inline", marginLeft: 10 }}>
            <input type="hidden" name="id" value={notice.id} />
            <input type="hidden" name="dealId" value={id} />
            <button className="btn ghost" type="submit">Dismiss</button>
          </form>
        </div>
      ))}
      {query.saved === "1" ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {rulesErrorNote(query.rulesError) ? <p className="private-note">{rulesErrorNote(query.rulesError)}</p> : null}
      {query.signed === "1" ? (
        <div className="callout">
          <b>Your signature is saved. Nothing was emailed.</b>
        </div>
      ) : null}
      {query.reply === "saved" ? <p className="note">Draft saved. Nothing was emailed.</p> : null}
      {query.replyError ? <p className="private-note">{query.replyError}</p> : null}
      {query.rate === "asked" ? <p className="note">Asked. Nothing was emailed.</p> : null}
      {query.rate === "confirmed" ? <p className="note">Rate confirmed. Nothing was paid.</p> : null}
      {query.rateError ? <p className="private-note">{query.rateError}</p> : null}
      {query.dates === "saved" ? <p className="note">Dates saved. Nothing was emailed or paid.</p> : null}
      {query.datesError ? <p className="private-note">{query.datesError}</p> : null}
      {selected ? null : (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2>That deal isn&apos;t on your list.</h2>
          <p className="note">If a brand is still in negotiation, Kamron hasn&apos;t turned it on for you yet.</p>
        </div>
      )}
      {screening ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sec-title">Offer screening</div>
          <p className="match-score">{screening.fit}</p>
          <p><b>{screening.verdictLabel}</b></p>
          {screening.suggestedAskCents != null ? <p>Suggested ask {formatMoney(screening.suggestedAskCents)}</p> : null}
          {screening.counterCents != null ? <p>Suggested counter {formatMoney(screening.counterCents)}</p> : null}
          {screening.feeCents != null ? <p>Commission {formatMoney(screening.feeCents)} (20%)</p> : null}
          {screening.profitWarn ? <p className="private-note">This deal is under the agency profit floor.</p> : null}
          {screening.categoryWarn ? <p className="private-note">This override lets a gambling, crypto, or investment-advice sponsor through. Have a lawyer review it before anyone is contacted.</p> : null}
          <ul>{screening.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {portal.viewer.role === "admin" && selected ? (
            <form action={setCategoryOverrideAction} className="stack">
              <input type="hidden" name="dealId" value={selected.id} />
              <label className="check">
                <input type="checkbox" name="override" value="1" defaultChecked={categoryOverride} />
                Override the gambling, crypto, and investment-advice block for this deal
              </label>
              <button className="btn ghost" type="submit">Save override</button>
            </form>
          ) : null}
        </div>
      ) : null}
      <DealBoard
        deals={deals}
        selected={selected}
        showDetail={Boolean(selected)}
        listNote={portal.viewed?.listNote ?? null}
        creatorQuery={creatorQuery}
        {...dealPowers(portal.viewer)}
        stageError={query.stageError === "1"}
        interestError={query.interestError === "1"}
        releaseError={query.releaseError ?? null}
        reviewError={query.reviewError ?? null}
        contractError={query.contractError ?? null}
        productError={query.productError ?? null}
        postError={query.postError ?? null}
        paymentError={query.paymentError ?? null}
        safetyError={query.safetyError ?? null}
      />
    </PortalFrame>
  );
}
