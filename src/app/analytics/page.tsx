import { AnalyticsPanel } from "@/components/analytics-panel";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { listDailyMetrics, listPostMetrics } from "@/lib/queries";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ creator?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
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
      hello={<div className="hello"><div><h1>Analytics</h1><p>Daily metrics are written by the agency bot. Example rows are labeled.</p></div></div>}
    >
      <div className="stack">
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
