import { decideDealReviewAction } from "@/app/deal-review-actions";
import { CREATOR_REVIEW_EMPTY, creatorReviewNeedsAction, dealReviewLabel, offerReviewStatus, reviewChoices, type CreatorDealReview } from "@/lib/creator-deal-review";
import type { PromoView } from "@/lib/promo-visuals";
import { PromoVisual } from "./promo-visual";

export function CreatorDealReviewCard({
  offers,
  note,
  title = "Needs your answer",
  visuals = {},
}: {
  offers: CreatorDealReview[];
  note?: string | null;
  title?: string;
  visuals?: Record<string, PromoView>;
}) {
  const actionable = offers.filter(creatorReviewNeedsAction);
  if (!actionable.length && !note) return null;
  return (
    <section className="card stack" style={{ marginBottom: 14 }}>
      <div className="sec-title">{title}</div>
      {note ? <p className="note">{note}</p> : null}
      {actionable.length === 0 ? <p className="note empty">{CREATOR_REVIEW_EMPTY}</p> : null}
      {actionable.map((offer) => {
        const status = offerReviewStatus(offer.decision);
        const choices = reviewChoices(offer.reviewMode, offer.decision);
        const closed = status === "passed" || status === "declined";
        return (
          <article key={offer.id} className="stack">
            <PromoVisual visual={visuals[offer.id]?.choice ?? null} brand={offer.brand} />
            <h2>{offer.brand}</h2>
            <p><b>{offer.offerLabel}</b></p>
            <p>{offer.summary}</p>
            <p className="note">{offer.contactEmail}</p>
            {closed ? (
              <p className="note">{dealReviewLabel(offer.decision)}. Nothing to accept.</p>
            ) : offer.decision ? (
              <p>Your answer: {dealReviewLabel(offer.decision)}{offer.counterNote ? `. ${offer.counterNote}` : ""}</p>
            ) : choices.length === 0 ? (
              <p className="note">For your information. Nothing to accept.</p>
            ) : (
              <div className="deal-review-actions">
                {choices.includes("accept") ? (
                  <form action={decideDealReviewAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <button className="btn" type="submit">I&apos;m interested</button>
                  </form>
                ) : <p className="note">You can counter this. Accepting it is closed.</p>}
                {choices.includes("counter") ? (
                  <form action={decideDealReviewAction} className="stack">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="decision" value="counter" />
                    <label>Suggest a counter
                      <textarea name="note" rows={2} />
                    </label>
                    <button className="btn ghost" type="submit">Suggest a counter</button>
                  </form>
                ) : null}
                {choices.includes("pass") ? (
                  <form action={decideDealReviewAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="decision" value="pass" />
                    <button className="btn ghost" type="submit">Pass</button>
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
