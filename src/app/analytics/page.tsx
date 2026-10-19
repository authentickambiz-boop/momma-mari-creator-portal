import { saveAnalyticsSnapshotAction } from "@/app/growth-actions";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { SnapshotBoard } from "@/components/analytics-snapshots";
import { PortalFrame } from "@/components/portal-frame";
import { analyticsBoard } from "@/lib/analytics-snapshots";
import { loadPortal } from "@/lib/current-user";
import { PLATFORM_OPTIONS } from "@/lib/niche-catalog";
import { listDailyMetrics, listPostMetrics } from "@/lib/queries";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; snapshotError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const board = await analyticsBoard(portal.db, portal.viewer);
  const shown = portal.viewed ? board.creators.filter((creator) => creator.creatorId === portal.viewed?.id) : board.creators;
  const creators = portal.viewed ? [portal.viewed] : portal.creators;
  const panels = await Promise.all(creators.map(async (creator) => ({
    creator,
    daily: await listDailyMetrics(portal.db, creator.id),
    posts: await listPostMetrics(portal.db, creator.id),
  })));
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="analytics"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Analytics</h1><p>Latest July snapshot for each platform, plus the change from the previous snapshot. Blank means July did not display it.</p></div></div>}
    >
      {params.saved ? <p className="note">Saved.</p> : null}
      {params.snapshotError ? <p className="private-note">{params.snapshotError}</p> : null}
      <SnapshotBoard creators={shown} showRevenue={board.showRevenue} />
      {portal.viewer.role === "admin" && portal.viewed ? (
        <form action={saveAnalyticsSnapshotAction} className="card stack" style={{ marginTop: 14 }}>
          <input type="hidden" name="creatorId" value={portal.viewed.id} />
          <div className="sec-title">Enter a snapshot for {portal.viewed.name}</div>
          <p className="note">Only your sign-in can add one. Leave a box empty when the number was not shown. A manager sees dollar amounts only if the pricing switch is on.</p>
          <label>Platform
            <select name="platform" defaultValue="TikTok">
              {PLATFORM_OPTIONS.map((platform) => <option key={platform}>{platform}</option>)}
            </select>
          </label>
          <label>Captured on<input name="capturedOn" type="date" required defaultValue="2026-10-19" /></label>
          <label>Period<input name="period" type="text" placeholder="Past 30d, or blank" /></label>
          <label>Followers<input name="followers" type="text" inputMode="decimal" /></label>
          <label>Views<input name="views" type="text" inputMode="decimal" /></label>
          <label>Average views<input name="avgViews" type="text" inputMode="decimal" /></label>
          <label>Engagement<input name="engagement" type="text" inputMode="decimal" placeholder="3.57%" /></label>
          <label>Saves<input name="saves" type="text" /></label>
          <label>Revenue, dollars<input name="revenue" type="text" inputMode="decimal" /></label>
          <button className="btn" type="submit">Save snapshot</button>
        </form>
      ) : null}
      <div className="stack" style={{ marginTop: 14 }}>
        {panels.map((panel) => (
          <section key={panel.creator.id}>
            {!portal.viewed ? <h2 style={{ marginBottom: 8 }}>{panel.creator.name}</h2> : null}
            <AnalyticsPanel creator={panel.creator} daily={panel.daily} posts={panel.posts} />
          </section>
        ))}
      </div>
    </PortalFrame>
  );
}
