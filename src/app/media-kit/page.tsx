import { saveMediaKitAction } from "@/app/media-kit-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { withBasePath } from "@/lib/format";
import { myMediaKit, zernioStatsEnabled } from "@/lib/media-kit";

export default async function MediaKitPage({ searchParams }: { searchParams: Promise<{ saved?: string; kitError?: string; slug?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  if (portal.viewer.role !== "creator" || !portal.viewer.creatorId) {
    return (
      <PortalFrame viewer={portal.viewer} tab="deals" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Media kit</h1>}>
        <p className="note">Creators edit their own media kit.</p>
      </PortalFrame>
    );
  }
  const kit = await myMediaKit(portal.db, portal.viewer);
  const zernio = zernioStatsEnabled();
  return (
    <PortalFrame viewer={portal.viewer} tab="kit" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Media kit</h1><p>Stats are typed in by hand. {zernio ? "Zernio stats are on for this portal." : "Zernio is off, so nothing is pulled in."}</p></div>}>
      {params.saved ? <p className="note">Saved.</p> : null}
      {kit?.published && kit.slug ? <p className="note">Share <a href={withBasePath(`/kit/${kit.slug}`)}>{withBasePath(`/kit/${kit.slug}`)}</a></p> : null}
      {params.kitError ? <p className="private-note">{params.kitError}</p> : null}
      <form action={saveMediaKitAction} className="card stack">
        <input type="hidden" name="creatorId" value={portal.viewer.creatorId} />
        <label><input type="checkbox" name="published" value="1" defaultChecked={kit?.published} /> Share this kit</label>
        <label>Display name<input name="displayName" required defaultValue={kit?.displayName ?? portal.viewer.name} /></label>
        <label>Bio<textarea name="bio" maxLength={280} defaultValue={kit?.bio ?? ""} /></label>
        <label>Followers<input name="followers" inputMode="numeric" defaultValue={kit?.followers ?? ""} /></label>
        <label>Average views<input name="avgViews" inputMode="numeric" defaultValue={kit?.avgViews ?? ""} /></label>
        <label>Engagement<input name="engagement" placeholder="3%" defaultValue={kit?.engagement ?? ""} /></label>
        <label>Niches<input name="niches" placeholder="parenting, home" defaultValue={kit?.niches ?? ""} /></label>
        <button className="btn" type="submit">Save media kit</button>
      </form>
    </PortalFrame>
  );
}
