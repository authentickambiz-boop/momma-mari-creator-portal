import Link from "next/link";
import { CopyText } from "@/components/copy-text";
import { PortalFrame } from "@/components/portal-frame";
import { isOwner } from "@/lib/authz";
import { loadPortal } from "@/lib/current-user";
import {
  checkpointSummary,
  formatSponsoredAverage,
  formatSponsoredCount,
  formatSponsoredDay,
  listSponsoredPosts,
  metricStat,
  safeSponsoredText,
  snapshotMetricPairs,
  sponsoredBrandRecap,
  sponsoredPostHref,
} from "@/lib/sponsored-posts";

export const dynamic = "force-dynamic";

export default async function SponsoredBrandRecapPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; creator?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (!isOwner(portal.viewer)) {
    return (
      <PortalFrame viewer={portal.viewer} tab="sponsored-posts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brand recap</h1>}>
        <p className="note">Brand recaps stay on the owner sign-in.</p>
      </PortalFrame>
    );
  }
  const requested = params.brand?.trim() ?? "";
  if (!requested) {
    const list = await listSponsoredPosts(portal.db, portal.viewer, { creatorId: "all" });
    const brands = list.ok ? list.rollup.byBrand : [];
    return (
      <PortalFrame viewer={portal.viewer} tab="sponsored-posts" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><div><h1>Brand recap</h1><p>Pick a brand. The summary is ready to copy. Nothing is emailed.</p></div></div>}>
        {brands.length === 0 ? <p className="note empty">No sponsored posts yet.</p> : (
          <ul>
            {brands.map((brand) => (
              <li key={brand.key}><Link href={`/sponsored-posts/recap?brand=${encodeURIComponent(brand.label)}`}>{brand.label}</Link></li>
            ))}
          </ul>
        )}
        <p><Link href="/sponsored-posts?creator=all">Back to sponsored posts</Link></p>
      </PortalFrame>
    );
  }
  const recap = await sponsoredBrandRecap(portal.db, portal.viewer, requested);
  if (!recap.ok) {
    return (
      <PortalFrame viewer={portal.viewer} tab="sponsored-posts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brand recap</h1>}>
        <p className="note">{recap.error}</p>
        <p><Link href="/sponsored-posts?creator=all">Back to sponsored posts</Link></p>
      </PortalFrame>
    );
  }
  const views = metricStat(recap.rollup, "7d", "views");
  const sevenDay = checkpointSummary(recap.rollup, "7d", { omit: ["views"] });
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="sponsored-posts"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>{recap.brand} recap</h1><p>Copy this into a recap email when you are ready. The portal does not send it.</p></div></div>}
    >
      <p><Link href="/sponsored-posts?creator=all">Back to sponsored posts</Link></p>
      <div className="stats">
        <div className="card stat"><div className="n">{recap.rollup.posts}</div><div className="l">Posts</div></div>
        <div className="card stat"><div className="n">{views ? formatSponsoredAverage(views.average) : "Not entered"}</div><div className="l">Average 7-day views</div></div>
        <div className="card stat"><div className="n">{views ? formatSponsoredCount(views.total) : "Not entered"}</div><div className="l">Total 7-day views</div></div>
      </div>
      {sevenDay ? <p className="note">{sevenDay}</p> : null}
      {recap.posts.length === 0 ? <p className="note empty">No sponsored posts for this brand yet.</p> : null}
      <div className="stack">
        {recap.posts.map((post) => {
          const href = sponsoredPostHref(post.postUrl);
          const terms = safeSponsoredText(post.deliverableTerms);
          return (
            <article key={post.id} className="card">
              <b>{post.creatorName}</b>
              <p>{post.platform} · {formatSponsoredDay(post.postedOn)}</p>
              <p>{terms ?? "Deliverable held back."}</p>
              {href ? <p><a href={href} rel="noopener noreferrer">Open post</a></p> : null}
              {post.dealId ? <p className="note">Portal deal linked.</p> : null}
              {post.campaignName && safeSponsoredText(post.campaignName) ? <p className="note">Campaign: {safeSponsoredText(post.campaignName)}</p> : null}
              {post.snapshots.length === 0 ? <p className="note">No checkpoints yet.</p> : post.snapshots.map((snapshot) => {
                const pairs = snapshotMetricPairs(snapshot);
                const note = safeSponsoredText(snapshot.note);
                return (
                  <p key={snapshot.id}>
                    {snapshot.checkpointLabel}: {pairs.length ? pairs.map((pair) => `${pair.label} ${formatSponsoredCount(pair.value)}`).join(", ") : "no counts entered"}
                    {note ? ` · ${note}` : ""}
                    {` · Entered by ${safeSponsoredText(snapshot.enteredByName) ?? "the owner"}`}
                  </p>
                );
              })}
            </article>
          );
        })}
      </div>
      <form className="card stack">
        <label>
          Copy for a recap email
          <textarea className="sponsored-recap" readOnly rows={18} defaultValue={recap.text} />
        </label>
        <CopyText text={recap.text} label="Copy recap" />
        <p className="note">This stays in the portal until you paste it somewhere yourself.</p>
      </form>
    </PortalFrame>
  );
}
