import { PortalFrame } from "@/components/portal-frame";
import { SponsoredPostLog } from "@/components/sponsored-post-log";
import { isOwner } from "@/lib/authz";
import { loadPortal } from "@/lib/current-user";
import { sponsoredErrorNote } from "@/lib/sponsored-post-notes";
import { listSponsoredPosts, sponsoredPostChoices, sponsoredSnapshotsDue } from "@/lib/sponsored-posts";

export const dynamic = "force-dynamic";

export default async function SponsoredPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; brand?: string; sort?: string; dir?: string; show?: string; saved?: string; sponsoredError?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const canManage = isOwner(portal.viewer);
  if (portal.viewer.role === "manager") {
    return (
      <PortalFrame viewer={portal.viewer} tab="sponsored-posts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Sponsored posts</h1>}>
        <p className="note">Sponsored post tracking stays with the owner.</p>
      </PortalFrame>
    );
  }
  const list = await listSponsoredPosts(portal.db, portal.viewer, {
    brand: params.brand ?? null,
    creatorId: portal.viewedId,
    includeArchived: params.show === "archived",
    sort: params.sort ?? null,
    dir: params.dir ?? null,
  });
  const choices = canManage ? await sponsoredPostChoices(portal.db, portal.viewer) : null;
  const asOf = new Date().toISOString();
  const dueList = canManage ? await listSponsoredPosts(portal.db, portal.viewer, { creatorId: "all" }) : null;
  const due = dueList && dueList.ok ? sponsoredSnapshotsDue(portal.viewer, dueList.posts, asOf) : null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="sponsored-posts"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Sponsored posts</h1><p>Every sponsored post a creator delivers, with counts at 24 hours, 7 days, and 30 days. The owner sees which snapshots are due. A creator can read her own posts. Nothing here is emailed.</p></div></div>}
    >
      {!list.ok ? <p className="note">{list.error}</p> : (
        <SponsoredPostLog
          canManage={canManage}
          list={list}
          choices={choices && choices.ok ? choices.choices : null}
          filters={{
            creator: portal.viewedId,
            brand: params.brand ?? "",
            sort: list.sort,
            dir: list.dir,
            show: params.show === "archived" ? "archived" : "",
          }}
          saved={params.saved ?? null}
          error={sponsoredErrorNote(params.sponsoredError)}
          creatorName={portal.viewed?.name ?? null}
          asOf={asOf}
          due={due && due.ok ? due.items : null}
        />
      )}
    </PortalFrame>
  );
}
