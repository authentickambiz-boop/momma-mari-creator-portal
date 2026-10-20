import { saveAnalyticsSnapshotAction } from "@/app/growth-actions";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { SnapshotBoard } from "@/components/analytics-snapshots";
import { PortalFrame } from "@/components/portal-frame";
import { analyticsBoard } from "@/lib/analytics-snapshots";
import { snapshotErrorNote } from "@/lib/snapshot-notes";
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
      hello={<div className="hello"><div><h1>Analytics</h1><p>Each Monday a snapshot is saved per platform. This card is the latest week, the change from the week before, and the trend. A blank means that number was not shown.</p></div></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {snapshotErrorNote(params.snapshotError) ? <p className="private-note">{snapshotErrorNote(params.snapshotError)}</p> : null}
      <SnapshotBoard creators={shown} showRevenue={board.showRevenue} />
      {portal.viewer.role === "admin" && portal.viewed ? (
        <form action={saveAnalyticsSnapshotAction} className="card stack" style={{ marginTop: 14 }}>
          <input type="hidden" name="creatorId" value={portal.viewed.id} />
          <div className="sec-title">Enter or edit a weekly snapshot for {portal.viewed.name}</div>
          <p className="note">Only your sign-in can save one. The same platform and capture date updates that week. An older week is left as it was. Leave a box empty when the number was not shown. A manager sees dollar amounts only if the pricing switch is on.</p>
          <label>Platform
            <select name="platform" defaultValue="TikTok">
              {PLATFORM_OPTIONS.map((platform) => <option key={platform}>{platform}</option>)}
            </select>
          </label>
          <label>Captured on<input name="capturedOn" type="date" required defaultValue="2026-10-19" /></label>
          <label>Date range<input name="period" type="text" placeholder="Past 30d, or blank" /></label>
          <label>Source<input name="source" type="text" defaultValue="July" /></label>
          <label>Followers<input name="followers" type="text" inputMode="decimal" /></label>
          <label>Engagement<input name="engagement" type="text" inputMode="decimal" placeholder="3.57%" /></label>
          <label>Views<input name="views" type="text" inputMode="decimal" /></label>
          <label>Reach<input name="reach" type="text" inputMode="decimal" /></label>
          <label>Likes<input name="likes" type="text" inputMode="decimal" /></label>
          <label>Comments<input name="comments" type="text" inputMode="decimal" /></label>
          <label>Shares<input name="shares" type="text" inputMode="decimal" /></label>
          <label>Saves<input name="saves" type="text" /></label>
          <label>Audience gender<textarea name="audienceGender" placeholder="Female 79%; Male 21%" /></label>
          <label>Audience age<textarea name="audienceAge" placeholder="18-24 40.5%" /></label>
          <label>Audience location<textarea name="audienceLocation" placeholder="USA 52.4%" /></label>
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
