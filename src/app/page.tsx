import { DealBoard } from "@/components/deal-board";
import { PortalFrame } from "@/components/portal-frame";
import { canChangeDealStage } from "@/lib/authz";
import { longDate } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";
import { getDealForViewer, listDealsForViewer } from "@/lib/queries";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ creator?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const deals = await listDealsForViewer(portal.db, portal.viewer, portal.viewedId);
  const fallback = deals.find((deal) => deal.id === "vev")?.id ?? deals[0]?.id;
  const selected = fallback ? await getDealForViewer(portal.db, portal.viewer, fallback) : null;
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
      <DealBoard
        deals={deals}
        selected={selected}
        showDetail={false}
        listNote={portal.viewed?.listNote ?? null}
        creatorQuery={creatorQuery}
        canChangeStage={canChangeDealStage(portal.viewer)}
      />
    </PortalFrame>
  );
}
