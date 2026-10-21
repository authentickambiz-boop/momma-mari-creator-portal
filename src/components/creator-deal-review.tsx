import { decideDealReviewAction } from "@/app/deal-review-actions";
import { dealReviewLabel, reviewChoices, type CreatorDealReview } from "@/lib/creator-deal-review";

export function CreatorDealReviewCard({ offers, note }: { offers: CreatorDealReview[]; note?: string | null }) {
  if (!offers.length) return null;
  return (
    <section className="card stack" style={{ marginBottom: 14 }}>
      <div className="sec-title">Deals for your review</div>
      {note ? <p className="note">{note}</p> : null}
      {offers.map((offer) => {
        const choices = reviewChoices(offer.reviewMode, offer.decision);
        return (
          <article key={offer.id} className="stack">
            <h2>{offer.brand}</h2>
            <p><b>{offer.offerLabel}</b></p>
            <p>{offer.summary}</p>
            <p className="note">{offer.contactEmail}</p>
            {offer.decision ? (
              <p>Your answer: {dealReviewLabel(offer.decision)}{offer.counterNote ? `. ${offer.counterNote}` : ""}</p>
            ) : choices.length === 0 ? (
              <p className="note">For your information. Nothing to accept.</p>
            ) : (
              <div className="deal-review-actions">
                {choices.includes("accept") ? (
                  <form action={decideDealReviewAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <button className="btn" type="submit">Accept</button>
                  </form>
                ) : <p className="note">You can counter this. Accepting it is closed.</p>}
                {choices.includes("counter") ? (
                  <form action={decideDealReviewAction} className="stack">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="decision" value="counter" />
                    <label>What should we ask for instead?
                      <textarea name="note" rows={2} />
                    </label>
                    <button className="btn ghost" type="submit">Counter</button>
                  </form>
                ) : null}
                {choices.includes("pass") ? (
                  <form action={decideDealReviewAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="decision" value="pass" />
                    <button className="btn ghost" type="submit">Pass to roster</button>
                  </form>
                ) : null}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
