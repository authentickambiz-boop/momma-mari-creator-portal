import { ConnectPanel } from "@/components/connect-panel";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ creator?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const creators = portal.viewed ? [portal.viewed] : portal.creators;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="connect"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Connect accounts</h1><p>Placeholder buttons until your bot adds the Zernio links.</p></div></div>}
    >
      <div className="stack">
        {creators.map((creator) => (
          <section key={creator.id}>
            {!portal.viewed ? <h2 style={{ marginBottom: 8 }}>{creator.name}</h2> : null}
            <ConnectPanel creator={creator} />
          </section>
        ))}
      </div>
    </PortalFrame>
  );
}
