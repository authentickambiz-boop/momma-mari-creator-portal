import { createBrandOfferAction, respondToOfferAction } from "@/app/offer-actions";
import { PortalFrame } from "@/components/portal-frame";
import { TagPicker } from "@/components/tag-picker";
import { listCreatorOffers, listOfferBoard, offerFlagLabel } from "@/lib/brand-offers";
import { loadPortal } from "@/lib/current-user";
import { DELIVERABLES } from "@/lib/deal-rules";
import { formatMoney } from "@/lib/format";
import { PLATFORM_OPTIONS } from "@/lib/niche-catalog";

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ saved?: string; offerError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  if (portal.viewer.role === "manager") {
    return (
      <PortalFrame viewer={portal.viewer} tab="offers" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brand offers</h1>}>
        <p className="note">Brand offers stay with the owner.</p>
      </PortalFrame>
    );
  }
  const creatorView = portal.viewer.role === "creator";
  const inbox = creatorView ? await listCreatorOffers(portal.db, portal.viewer) : [];
  const board = portal.viewer.role === "admin" ? await listOfferBoard(portal.db, portal.viewer) : [];
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="offers"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Brand offers</h1><p>{creatorView ? "What the brand will pay you. Your minimum stays private." : "Send a brand offer to the creators whose minimum and monthly cap fit. Lowest rank goes first."}</p></div></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {params.offerError ? <p className="private-note">{params.offerError}</p> : null}
      {creatorView ? (
        <div className="stack">
          {inbox.length === 0 ? <p className="note">No brand offers in your inbox.</p> : null}
          {inbox.map((offer) => (
            <article key={offer.id} className="card stack">
              <b>{offer.brand}</b>
              <p>{offer.deliverables.join(", ") || "Deliverables TBD"} · {offer.platforms.join(", ")}</p>
              <p>{offer.startsOn || "Start TBD"} to {offer.endsOn || "end TBD"}</p>
              <p>The brand will pay {formatMoney(offer.budgetCents)} for this.</p>
              {offer.contactName ? <p className="note">Contact: {offer.contactName}</p> : null}
              <p className="note">{offer.response === "pending" ? "Waiting on you" : offer.response === "accepted" ? "You accepted" : offer.response === "declined" ? "You declined" : "You asked a question"}</p>
              {offer.question ? <p>{offer.question}</p> : null}
              {offer.response === "pending" || offer.response === "question" ? (
                <>
                  <form action={respondToOfferAction}>
                    <input type="hidden" name="allocationId" value={offer.id} />
                    <input type="hidden" name="decision" value="accepted" />
                    <button className="btn" type="submit">Accept</button>
                  </form>
                  <form action={respondToOfferAction}>
                    <input type="hidden" name="allocationId" value={offer.id} />
                    <input type="hidden" name="decision" value="declined" />
                    <button className="btn ghost" type="submit">Decline</button>
                  </form>
                  <form action={respondToOfferAction} className="stack">
                    <input type="hidden" name="allocationId" value={offer.id} />
                    <input type="hidden" name="decision" value="question" />
                    <label>Question for Kamron<textarea name="question" rows={3} defaultValue={offer.question ?? ""} /></label>
                    <button className="btn ghost" type="submit">Ask a question</button>
                  </form>
                </>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <>
          <form action={createBrandOfferAction} className="card stack">
            <div className="sec-title">New brand offer</div>
            <label>Brand<input name="brand" required /></label>
            <label>Contact name<input name="contactName" required /></label>
            <label>Contact email<input name="contactEmail" type="email" /></label>
            <TagPicker name="deliverables" label="Deliverables" options={DELIVERABLES.map((item) => item.label)} selected={[]} />
            <TagPicker name="platforms" label="Platforms" options={PLATFORM_OPTIONS} selected={[]} />
            <label>Starts<input name="startsOn" placeholder="2026-11-01" /></label>
            <label>Ends<input name="endsOn" placeholder="2026-11-30" /></label>
            <label>Next follow-up<input name="nextFollowUp" placeholder="2026-11-15" /></label>
            <div className="sec-title">Budget per creator</div>
            <p className="note">Leave a creator blank to skip her. The amount is what the brand pays her, not her minimum.</p>
            {portal.creators.map((creator) => (
              <label key={creator.id}>
                {creator.name}
                <input type="hidden" name="creatorId" value={creator.id} />
                <input name={`budget-${creator.id}`} inputMode="decimal" placeholder="Budget" />
              </label>
            ))}
            <button className="btn" type="submit">Send offer</button>
          </form>
          <div className="stack" style={{ marginTop: 14 }}>
            {board.map((offer) => (
              <article key={offer.id} className="card">
                <b>{offer.brand}</b>
                <p>{offer.contactName}{offer.contactEmail ? ` · ${offer.contactEmail}` : ""}</p>
                <p>{offer.deliverables.join(", ")} · {offer.platforms.join(", ")}</p>
                <p>{offer.startsOn || "Start TBD"} to {offer.endsOn || "end TBD"}{offer.nextFollowUp ? ` · Follow-up ${offer.nextFollowUp}` : ""}</p>
                {offer.flagLabel ? <p className="callout"><b>{offer.flagLabel}</b>{offer.flag === "pitch_retainer" ? " Momma Mari marketing services." : ""}</p> : null}
                {offer.recipients.length === 0 ? <p className="note">No creator inbox received this. {offerFlagLabel(offer.flag) ?? ""}</p> : null}
                <ul>
                  {offer.recipients.map((person) => (
                    <li key={person.id}>
                      {person.creatorName} · {formatMoney(person.budgetCents)} · {person.response}
                      {person.question ? ` · ${person.question}` : ""}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </PortalFrame>
  );
}
