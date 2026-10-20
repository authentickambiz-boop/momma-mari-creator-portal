import {
  applyGiftedOfferAction,
  approveGiftedAction,
  createGiftedOfferAction,
  deliverGiftedAction,
  flagGiftedOwedAction,
  postGiftedAction,
  shipGiftedAction,
} from "@/app/gift-actions";
import { PortalFrame } from "@/components/portal-frame";
import { GIFTED_TERMS_TEXT, GIFTED_TERMS_VERSION } from "@/config/gifted-terms";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { listGiftedBoard, listGiftedOverdue } from "@/lib/gifted";
import { giftErrorNote } from "@/lib/gift-notes";

export const dynamic = "force-dynamic";

function TermsNote() {
  return (
    <div className="callout">
      <b>DRAFT. Pending lawyer review.</b>
      <p style={{ whiteSpace: "pre-wrap" }}>{GIFTED_TERMS_TEXT}</p>
      <p className="note">Version {GIFTED_TERMS_VERSION}. Have an attorney review this wording before you rely on it. Nothing is charged from this page.</p>
    </div>
  );
}

export default async function GiftsPage({ searchParams }: { searchParams: Promise<{ saved?: string; giftsError?: string }> }) {
  const params = await searchParams;
  const giftsError = giftErrorNote(params.giftsError);
  const portal = await loadPortal(null);
  if (portal.viewer.role === "manager") {
    return (
      <PortalFrame viewer={portal.viewer} tab="gifts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Free products</h1>}>
        <p className="note">Free products stay with Kamron.</p>
      </PortalFrame>
    );
  }
  const board = await listGiftedBoard(portal.db, portal.viewer);
  const overdue = portal.viewer.role === "admin" ? await listGiftedOverdue(portal.db, portal.viewer) : [];
  const creatorView = portal.viewer.role === "creator";
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="gifts"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>Free products</h1>
            <p>{creatorView ? "Gifted products you can apply for. Kamron approves each person." : "Post a gifted product. You approve who receives it. Nothing is charged automatically."}</p>
          </div>
        </div>
      }
    >
      {giftsError ? <p className="private-note">{giftsError}</p> : null}
      {params.saved === "posted" ? <p className="note">Posted. The brand is tagged as a future paid prospect. Nothing was emailed.</p> : null}
      {params.saved === "applied" ? <p className="note">Applied. Kamron still has to approve you. Nothing was charged.</p> : null}
      {params.saved === "approved" ? <p className="note">Approved. Nothing was charged or emailed.</p> : null}
      {params.saved === "shipped" ? <p className="note">Marked shipped. Nothing was charged.</p> : null}
      {params.saved === "delivered" ? <p className="note">Marked delivered. Nothing was charged.</p> : null}
      {params.saved === "owed" ? <p className="note">Amount flagged. Nothing was charged.</p> : null}
      {params.saved === "posted-video" ? <p className="note">Video link saved. Nothing was emailed.</p> : null}

      {portal.viewer.role === "admin" ? (
        <div className="card stack" id="gift-overdue" style={{ marginBottom: 14 }}>
          <div className="sec-title">Overdue</div>
          {overdue.length === 0 ? <p className="note empty">No overdue videos.</p> : null}
          {overdue.map((row) => (
            <article key={row.id} className="choice stack">
              <b>{row.product}</b>
              <p className="note">{row.name} · {row.brand} · due {row.dueOn} · {row.label}</p>
              {row.status === "charged" ? (
                <p>Amount owed {formatMoney(row.amountOwedCents ?? 0)}. Not charged.</p>
              ) : row.deliveredAt ? (
                <p className="private-note">The video was not posted by the due date. You can flag {formatMoney(row.retailValueCents)} plus the $50 finder&apos;s fee. Nothing is charged automatically.</p>
              ) : (
                <p className="note">The due date passed and the video is not posted. The product is not marked delivered, so nothing is owed yet.</p>
              )}
              {row.status === "overdue" && row.deliveredAt ? (
                <form action={flagGiftedOwedAction}>
                  <input type="hidden" name="applicationId" value={row.id} />
                  <button className="btn" type="submit">Flag amount owed</button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : <TermsNote />}

      {portal.viewer.role === "admin" ? (
        <form action={createGiftedOfferAction} className="card stack" style={{ marginBottom: 14 }}>
          <div className="sec-title">Post a gifted product</div>
          <label>Brand<input name="brand" required placeholder="Glow Soap" /></label>
          <label>Product<input name="product" required placeholder="Glow bar" /></label>
          <label>Photos, one link per line<textarea name="photos" required placeholder="https://example.com/glow.jpg" /></label>
          <label>Required video<input name="deliverable" required placeholder="1 TikTok" /></label>
          <label>Due date<input name="dueOn" required placeholder="2026-11-20" /></label>
          <p className="note">Use a date like 2026-11-20.</p>
          <label>Retail value, dollars<input name="retail" required inputMode="decimal" placeholder="24" /></label>
          <p className="note">This does not email the brand and does not charge anyone.</p>
          <button className="btn" type="submit">Post free product</button>
        </form>
      ) : null}

      <div className="stack">
        {board.length === 0 ? <p className="note empty">No free products yet. Nothing is charged.</p> : null}
        {board.map((offer) => (
          <article key={offer.id} className="card stack" id={`gift-${offer.id}`}>
            <b>{offer.product}</b>
            <p className="note">{offer.brand} · {offer.deliverable} · due {offer.dueOn}</p>
            <p>Retail value {formatMoney(offer.retailValueCents)}</p>
            <div className="stage-form">
              {offer.photos.map((photo) => (
                <img key={photo} src={photo} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12 }} />
              ))}
            </div>
            {creatorView && !offer.mine ? (
              <form action={applyGiftedOfferAction} className="stack">
                <input type="hidden" name="offerId" value={offer.id} />
                <input type="hidden" name="termsVersion" value={GIFTED_TERMS_VERSION} />
                <label className="contract-choices">
                  <input type="checkbox" name="acceptTerms" value="1" required />
                  I accept the draft terms. If I receive the product and miss the video, the retail cost plus a $50 finder&apos;s fee can be flagged.
                </label>
                <button className="btn" type="submit">Apply</button>
              </form>
            ) : null}
            {offer.mine ? <p className="note">Your status: {offer.mine.label}</p> : null}
            {creatorView && offer.mine && (offer.mine.status === "delivered" || offer.mine.status === "overdue") ? (
              <form action={postGiftedAction} className="stage-form">
                <input type="hidden" name="applicationId" value={offer.mine.id} />
                <label>Video link<input name="postUrl" required placeholder="https://" /></label>
                <button className="btn" type="submit">Mark posted</button>
              </form>
            ) : null}
            {portal.viewer.role === "admin" ? (
              offer.applicants.length === 0 ? <p className="note empty">No one has applied. Nothing is charged.</p> : offer.applicants.map((row) => (
                <div key={row.id} className="choice stack">
                  <b>{row.name}</b>
                  <p className="note">{row.label} · terms {row.termsVersion} · accepted {row.termsAcceptedAt}</p>
                  {row.status === "applied" ? (
                    <form action={approveGiftedAction}>
                      <input type="hidden" name="applicationId" value={row.id} />
                      <button className="btn" type="submit">Approve</button>
                    </form>
                  ) : null}
                  {row.status === "approved" ? (
                    <form action={shipGiftedAction}>
                      <input type="hidden" name="applicationId" value={row.id} />
                      <button className="btn ghost" type="submit">Mark shipped</button>
                    </form>
                  ) : null}
                  {row.status === "shipped" ? (
                    <form action={deliverGiftedAction}>
                      <input type="hidden" name="applicationId" value={row.id} />
                      <button className="btn ghost" type="submit">Mark delivered</button>
                    </form>
                  ) : null}
                  {row.status === "delivered" || row.status === "overdue" ? (
                    <form action={postGiftedAction} className="stage-form">
                      <input type="hidden" name="applicationId" value={row.id} />
                      <label>Video link<input name="postUrl" required placeholder="https://" /></label>
                      <button className="btn ghost" type="submit">Mark posted</button>
                    </form>
                  ) : null}
                  {row.status === "charged" ? <p>Amount owed {formatMoney(row.amountOwedCents ?? 0)}. Not charged.</p> : null}
                </div>
              ))
            ) : null}
          </article>
        ))}
      </div>
    </PortalFrame>
  );
}
