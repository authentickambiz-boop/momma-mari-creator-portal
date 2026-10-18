import { dismissCreatorNoticeAction } from "@/app/actions";
import { DealBoard } from "@/components/deal-board";
import { PortalFrame } from "@/components/portal-frame";
import { canChangeDealStage } from "@/lib/authz";
import { longDate } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";
import { getDealForViewer, listDealsForViewer } from "@/lib/queries";
import { listUnreadCreatorNotices } from "@/lib/video-review";

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creator?: string; stageError?: string; interestError?: string; releaseError?: string; reviewError?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(query.creator ?? null);
  const creatorNotices = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await listUnreadCreatorNotices(portal.db, portal.viewer.creatorId)
    : [];
  const deals = await listDealsForViewer(portal.db, portal.viewer, portal.viewedId);
  const selected = await getDealForViewer(portal.db, portal.viewer, id);
  const creatorQuery = portal.viewer.role === "admin" ? `?creator=${portal.viewedId}` : "";
  const visible = deals.filter((deal) => deal.visibleToCreator && deal.status !== "paid");
  const need = deals.filter((deal) => deal.visibleToCreator && deal.needsCreator);
  const hidden = deals.filter((deal) => !deal.visibleToCreator);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="deals"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>{portal.viewed ? `Hi ${portal.viewed.name} 👋` : "All creators"}</h1>
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
      {selected ? null : (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2>That deal isn&apos;t on your list.</h2>
          <p className="note">If a brand is still in negotiation, Kamron hasn&apos;t turned it on for you yet.</p>
        </div>
      )}
      <DealBoard
        deals={deals}
        selected={selected}
        showDetail={Boolean(selected)}
        listNote={portal.viewed?.listNote ?? null}
        creatorQuery={creatorQuery}
        canChangeStage={canChangeDealStage(portal.viewer)}
        stageError={query.stageError === "1"}
        interestError={query.interestError === "1"}
        releaseError={query.releaseError ?? null}
        reviewError={query.reviewError ?? null}
      />
    </PortalFrame>
  );
}
