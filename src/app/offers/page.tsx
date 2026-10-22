import { creatorInterestAction } from "@/app/actions";
import { counterSharedOfferAction, createBrandOfferAction, passSharedOfferAction, respondToOfferAction } from "@/app/offer-actions";
import { CreatorDealReviewCard } from "@/components/creator-deal-review";
import { PortalFrame } from "@/components/portal-frame";
import { TagPicker } from "@/components/tag-picker";
import { listCreatorOffers, listOfferBoard, offerFlagLabel } from "@/lib/brand-offers";
import { CREATOR_REVIEW_EMPTY, creatorReviewNeedsAction, listCreatorDealReviews } from "@/lib/creator-deal-review";
import { listSharedOffers } from "@/lib/creator-interest";
import { loadPortal } from "@/lib/current-user";
import { DELIVERABLES } from "@/lib/deal-rules";
import { formatMoney } from "@/lib/format";
import { PLATFORM_OPTIONS } from "@/lib/niche-catalog";
import { offerErrorNote } from "@/lib/offer-notes";
import { promoErrorNote } from "@/lib/promo-notes";
import { loadPromoViews, promoViewsForOffers } from "@/lib/promo-visuals";
import { PromoVisual } from "@/components/promo-visual";
import Link from "next/link";

const REVIEW_NOTES: Record<string, string> = {
  saved: "Your answer is saved. Nothing was emailed.",
  role: "Only the creator can answer this offer.",
  choice: "Choose accept, counter, or pass.",
  missing: "That offer is not on your list.",
  own: "You can only answer your own offers.",
  answered: "You already answered this offer.",
  closed: "You can't accept this offer.",
  info: "This offer is for your information.",
  "1": "That answer was not saved.",
};

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ saved?: string; offerError?: string; review?: string; promo?: string; promoError?: string }> }) {
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
  const reviews = creatorView && portal.viewer.creatorId ? await listCreatorDealReviews(portal.db, portal.viewer.creatorId) : [];
  const shared = creatorView ? await listSharedOffers(portal.db, portal.viewer) : [];
  const openInbox = inbox.filter((offer) => offer.response === "pending" || offer.response === "question");
  const openReviews = reviews.filter(creatorReviewNeedsAction);
  const board = portal.viewer.role === "admin" ? await listOfferBoard(portal.db, portal.viewer) : [];
  const offerVisuals = await promoViewsForOffers(portal.db, [
    ...board.map((offer) => ({ id: offer.id, brand: offer.brand, deliverables: offer.deliverables })),
    ...inbox.map((offer) => ({ id: offer.campaignId, brand: offer.brand, deliverables: offer.deliverables })),
  ]);
  const sharedVisuals = await loadPromoViews(portal.db, shared.map((offer) => ({
    key: offer.id,
    type: "deal" as const,
    id: offer.id,
    brand: offer.brand,
    productName: offer.subtitle,
    dealId: offer.id,
  })));
  const reviewVisuals = await loadPromoViews(portal.db, openReviews.map((offer) => ({
    key: offer.id,
    type: "review" as const,
    id: offer.id,
    brand: offer.brand,
    productName: offer.offerLabel,
    dealId: null,
  })));
  const offerError = offerErrorNote(params.offerError);
  const reviewNote = params.review ? REVIEW_NOTES[params.review] ?? REVIEW_NOTES["1"] : null;
  const nothingToAnswer = creatorView && openInbox.length === 0 && openReviews.length === 0 && shared.length === 0;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="offers"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Brand offers</h1><p>{creatorView ? "New offers Kamron shared. Say you're interested, pass, or suggest a counter. Your minimum stays private. Nothing is emailed." : "Save a brand offer for the creators whose minimum and monthly cap fit. Lowest rank goes first. Nothing is emailed."}</p></div></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {params.promo === "saved" ? <p className="note">Product image saved. Nothing was emailed.</p> : null}
      {promoErrorNote(params.promoError) ? <p className="private-note">{promoErrorNote(params.promoError)}</p> : null}
      {reviewNote ? <p className="note">{reviewNote}</p> : null}
      {offerError ? <p className="private-note">{offerError}</p> : null}
      {creatorView ? (
        <div className="stack">
          {nothingToAnswer ? <p className="note empty">{CREATOR_REVIEW_EMPTY}</p> : null}
          <CreatorDealReviewCard offers={openReviews} visuals={reviewVisuals} />
          {openInbox.map((offer) => (
            <article key={offer.id} className="card stack">
              <PromoVisual visual={offerVisuals[offer.campaignId]?.choice ?? null} brand={offer.brand} showCheck={false} />
              <b>{offer.brand}</b>
              <p>{offer.deliverables.join(", ") || "Deliverables TBD"} · {offer.platforms.join(", ")}</p>
              <p>{offer.startsOn || "Start TBD"} to {offer.endsOn || "end TBD"}</p>
              <p>The brand will pay {formatMoney(offer.budgetCents)} for this.</p>
              {offer.contactName ? <p className="note">Contact: {offer.contactName}</p> : null}
              {offer.question ? <p className="note">Counter you suggested: {offer.question}</p> : null}
              <p className="note"><Link href={`/offers/${offer.campaignId}`}>Product detail</Link></p>
              <div className="deal-review-actions">
                <form action={respondToOfferAction}>
                  <input type="hidden" name="allocationId" value={offer.id} />
                  <input type="hidden" name="decision" value="accepted" />
                  <button className="btn" type="submit">I&apos;m interested</button>
                </form>
                {offer.response === "pending" ? (
                  <form action={respondToOfferAction} className="stack">
                    <input type="hidden" name="allocationId" value={offer.id} />
                    <input type="hidden" name="decision" value="question" />
                    <label>Suggest a counter
                      <textarea name="question" rows={2} />
                    </label>
                    <button className="btn ghost" type="submit">Suggest a counter</button>
                  </form>
                ) : null}
                <form action={respondToOfferAction}>
                  <input type="hidden" name="allocationId" value={offer.id} />
                  <input type="hidden" name="decision" value="declined" />
                  <button className="btn ghost" type="submit">Pass</button>
                </form>
              </div>
            </article>
          ))}
          {shared.map((offer) => (
            <article key={offer.id} className="card stack">
              <PromoVisual visual={sharedVisuals[offer.id]?.choice ?? null} brand={offer.brand} showCheck={false} />
              <b>{offer.brand}</b>
              {offer.subtitle ? <p>{offer.subtitle}</p> : null}
              {offer.amountDisplay ? <p>The brand will pay {offer.amountDisplay} for this.</p> : null}
              {offer.counter ? <p className="note">Counter you suggested: {offer.counter}</p> : null}
              <div className="deal-review-actions">
                <form action={creatorInterestAction}>
                  <input type="hidden" name="dealId" value={offer.id} />
                  <input type="hidden" name="decision" value="interested" />
                  <input type="hidden" name="back" value="offers" />
                  <button className="btn" type="submit">I&apos;m interested</button>
                </form>
                <form action={counterSharedOfferAction} className="stack">
                  <input type="hidden" name="dealId" value={offer.id} />
                  <label>Suggest a counter
                    <textarea name="note" rows={2} />
                  </label>
                  <button className="btn ghost" type="submit">Suggest a counter</button>
                </form>
                <form action={passSharedOfferAction}>
                  <input type="hidden" name="dealId" value={offer.id} />
                  <button className="btn ghost" type="submit">Pass</button>
                </form>
              </div>
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
            <label>Product name<input name="productName" placeholder="Glow bar" /></label>
            <label>Product page<input name="productPageUrl" placeholder="https://brand.com/products/glow-bar" /></label>
            <label>Image link<input name="ownerImageUrl" placeholder="https://brand.com/glow.jpg" /></label>
            <p className="note">A photo from the brand email is used first, then this product page, then this link. Nothing is emailed.</p>
            <div className="sec-title">Budget per creator</div>
            <p className="note">Leave a creator blank to skip her. The amount is what the brand pays her, not her minimum.</p>
            {portal.creators.map((creator) => (
              <label key={creator.id}>
                {creator.name}
                <input type="hidden" name="creatorId" value={creator.id} />
                <input name={`budget-${creator.id}`} inputMode="decimal" placeholder="Budget" />
              </label>
            ))}
            <p className="note">This adds the offer to her portal. Nothing is emailed.</p>
            <button className="btn" type="submit">Save offer</button>
          </form>
          <div className="stack" style={{ marginTop: 14 }}>
            {board.map((offer) => (
              <article key={offer.id} className="card stack">
                <PromoVisual visual={offerVisuals[offer.id]?.choice ?? null} brand={offer.brand} showCheck />
                <b>{offer.brand}</b>
                <p className="note"><Link href={`/offers/${offer.id}`}>Product detail</Link></p>
                <p>{offer.contactName}{offer.contactEmail ? ` · ${offer.contactEmail}` : ""}</p>
                <p>{offer.deliverables.join(", ")} · {offer.platforms.join(", ")}</p>
                <p>{offer.startsOn || "Start TBD"} to {offer.endsOn || "end TBD"}{offer.nextFollowUp ? ` · Follow-up ${offer.nextFollowUp}` : ""}</p>
                {offer.flagLabel ? <p className="callout"><b>{offer.flagLabel}</b>{offer.flag === "pitch_retainer" ? " Momma Mari marketing services." : ""}</p> : null}
                {offer.recipients.length === 0 ? <p className="note empty">No creator inbox received this. {offerFlagLabel(offer.flag) ?? ""}</p> : null}
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
