import Link from "next/link";
import { editReviewAction, publishReviewAction, rejectReviewAction, saveReplyDraftAction } from "@/app/review-actions";
import { CopyText } from "@/components/copy-text";
import { PortalFrame } from "@/components/portal-frame";
import { brandReplyDrafts } from "@/db/schema";
import { loadPortal } from "@/lib/current-user";
import { listDealReviews } from "@/lib/deal-review";
import { stageAdminLabel } from "@/lib/stages";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ saved?: string; reviewError?: string; deal?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="review" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Deal review</h1>}>
        <p className="note">Only Kamron reviews new deals.</p>
      </PortalFrame>
    );
  }
  const queue = await listDealReviews(portal.db);
  const drafts = await portal.db.select().from(brandReplyDrafts);
  const draftByDeal = new Map(drafts.map((row) => [row.dealId, row.body]));
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="review"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Deal review</h1><p>New deals stay hidden until you publish them. Nothing here sends email.</p></div></div>}
    >
      {params.saved === "draft" ? <p className="note">Draft saved. Nothing was emailed.</p> : null}
      {params.saved === "published" ? <p className="note">Published. The creator can see it now.</p> : null}
      {params.saved === "rejected" ? <p className="note">Rejected. The creator still cannot see it.</p> : null}
      {params.reviewError ? <p className="private-note">{params.reviewError}</p> : null}
      {queue.length === 0 ? <p className="note">Nothing is waiting for review.</p> : null}
      <div className="stack">
        {queue.map((deal) => {
          const draft = draftByDeal.get(deal.id) ?? "";
          return (
            <article key={deal.id} className="card stack" id={`review-${deal.id}`}>
              <b>{deal.brand}</b>
              <p className="note">{deal.creatorName} · {stageAdminLabel(deal.workflowStage)} · Hidden from the creator</p>
              <form action={editReviewAction} className="stack">
                <input type="hidden" name="dealId" value={deal.id} />
                <label>Brand<input name="brand" defaultValue={deal.brand} /></label>
                <label>Subtitle<input name="subtitle" defaultValue={deal.subtitle ?? ""} /></label>
                <label>Brand post date<input name="postDate" defaultValue={deal.postDate ?? ""} placeholder="2026-11-20" /></label>
                <label>Agreed rate, dollars<input name="rate" inputMode="decimal" placeholder="800" /></label>
                <label>Notes only you see<textarea name="kamronNotes" rows={2} /></label>
                <label className="contract-choices"><input type="checkbox" name="productRequired" value="1" defaultChecked={deal.productRequired} /> Product required</label>
                <label className="contract-choices"><input type="checkbox" name="rushRevision" value="1" defaultChecked={deal.rushRevision} /> Rush revision</label>
                <button className="btn ghost" type="submit">Save edits</button>
              </form>
              <form action={saveReplyDraftAction} className="stack">
                <input type="hidden" name="dealId" value={deal.id} />
                <label>Reply draft, only you see this<textarea name="body" rows={4} defaultValue={draft} placeholder="Hi, MariClare is interested..." /></label>
                <button className="btn ghost" type="submit">Save draft</button>
              </form>
              {draft ? <CopyText text={draft} label="Copy reply" /> : null}
              <p className="note">Saving a draft does not email the brand. Copy it, or send it yourself later.</p>
              <form action={publishReviewAction}>
                <input type="hidden" name="dealId" value={deal.id} />
                <button className="btn" type="submit">Publish to {deal.creatorName}</button>
              </form>
              <form action={rejectReviewAction}>
                <input type="hidden" name="dealId" value={deal.id} />
                <button className="btn ghost" type="submit">Reject</button>
              </form>
              <Link href={`/deals/${deal.id}?creator=${deal.creatorId}`}>Open the deal</Link>
            </article>
          );
        })}
      </div>
    </PortalFrame>
  );
}
