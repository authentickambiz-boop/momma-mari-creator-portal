import { saveMediaKitAction } from "@/app/media-kit-actions";
import { PortalFrame } from "@/components/portal-frame";
import { TagPicker } from "@/components/tag-picker";
import { loadPortal } from "@/lib/current-user";
import { withBasePath } from "@/lib/format";
import { SnapshotBoard } from "@/components/analytics-snapshots";
import { analyticsBoard } from "@/lib/analytics-snapshots";
import { myMediaKit, parsePlatformStats, zernioStatsEnabled } from "@/lib/media-kit";
import { NICHE_CATALOG } from "@/lib/niche-catalog";
import { MEDIA_KIT_CATALOG, PLATFORM_METRICS } from "@/lib/platforms";

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
  const board = await analyticsBoard(portal.db, portal.viewer);
  const stats = parsePlatformStats(kit?.platformsJson);
  const zernio = zernioStatsEnabled();
  return (
    <PortalFrame viewer={portal.viewer} tab="kit" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Media kit</h1><p>Stats are typed in by hand. {zernio ? "Zernio stats are on for this portal." : "Zernio is off, so nothing is pulled in."}</p></div>}>
      {params.saved ? <p className="note">Saved.</p> : null}
      {kit?.published && kit.slug ? <p className="note">Share <a href={withBasePath(`/kit/${kit.slug}`)}>{withBasePath(`/kit/${kit.slug}`)}</a></p> : null}
      {params.kitError ? <p className="private-note">{params.kitError}</p> : null}
      <SnapshotBoard creators={board.creators} showRevenue={false} />
      <div className="card">
        <div className="sec-title">Catalog price</div>
        <p className="note">A kit is sold at the existing catalog price. Nothing is charged from this page.</p>
        {MEDIA_KIT_CATALOG.map((item) => <p key={item.id}>{item.name}: {item.priceLabel}</p>)}
      </div>
      <form action={saveMediaKitAction} className="card stack" style={{ marginTop: 14 }}>
        <input type="hidden" name="creatorId" value={portal.viewer.creatorId} />
        <label><input type="checkbox" name="published" value="1" defaultChecked={kit?.published} /> Share this kit</label>
        <label>Display name<input name="displayName" required defaultValue={kit?.displayName ?? portal.viewer.name} /></label>
        <label>Bio<textarea name="bio" maxLength={280} defaultValue={kit?.bio ?? ""} /></label>
        <label>Followers<input name="followers" inputMode="numeric" defaultValue={kit?.followers ?? ""} /></label>
        <label>Average views<input name="avgViews" inputMode="numeric" defaultValue={kit?.avgViews ?? ""} /></label>
        <label>Engagement<input name="engagement" placeholder="3%" defaultValue={kit?.engagement ?? ""} /></label>
        <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={(kit?.niches ?? "").split(",").map((item) => item.trim()).filter(Boolean)} placeholder="Search niches" />
        <div className="sec-title">Platform stats</div>
        {PLATFORM_METRICS.map((item, index) => (
          <label key={`${item.platform}-${item.metric}`}>
            {item.platform}: {item.metric}
            <input name={`metric-${index}`} inputMode="decimal" defaultValue={stats.find((stat) => stat.platform === item.platform && stat.metric === item.metric)?.value ?? ""} />
          </label>
        ))}
        <button className="btn" type="submit">Save media kit</button>
      </form>
    </PortalFrame>
  );
}
