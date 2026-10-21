import { decideDealReviewAction } from "@/app/deal-review-actions";
import { dealReviewLabel, type CreatorDealReview } from "@/lib/creator-deal-review";

export function CreatorDealReviewCard({ offers, note }: { offers: CreatorDealReview[]; note?: string | null }) {
  if (!offers.length) return null;
  return (
    <section className="card stack" style={{ marginBottom: 14 }}>
      <div className="sec-title">Deals for your review</div>
      {note ? <p className="note">{note}</p> : null}
      {offers.map((offer) => (
        <article key={offer.id} className="stack">
          <h2>{offer.brand}</h2>
          <p><b>{offer.offerLabel}</b></p>
          <p>{offer.summary}</p>
          <p className="note">{offer.contactEmail}</p>
          {offer.decision ? (
            <p>Your answer: {dealReviewLabel(offer.decision)}{offer.counterNote ? `. ${offer.counterNote}` : ""}</p>
          ) : (
            <div className="deal-review-actions">
              <form action={decideDealReviewAction}>
                <input type="hidden" name="offerId" value={offer.id} />
                <input type="hidden" name="decision" value="accept" />
                <button className="btn" type="submit">Accept</button>
              </form>
              <form action={decideDealReviewAction} className="stack">
                <input type="hidden" name="offerId" value={offer.id} />
                <input type="hidden" name="decision" value="counter" />
                <label>What should we ask for instead?
                  <textarea name="note" rows={2} />
                </label>
                <button className="btn ghost" type="submit">Counter</button>
              </form>
              <form action={decideDealReviewAction}>
                <input type="hidden" name="offerId" value={offer.id} />
                <input type="hidden" name="decision" value="pass" />
                <button className="btn ghost" type="submit">Pass to roster</button>
              </form>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
