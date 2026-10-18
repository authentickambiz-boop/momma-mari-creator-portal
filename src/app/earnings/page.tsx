import { redirect } from "next/navigation";
import { EarningsPanel } from "@/components/earnings-panel";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { listDealsForViewer, listInbox, listPaymentsForDeals } from "@/lib/queries";
import type { CreatorProfile } from "@/lib/types";

async function panelFor(db: Awaited<ReturnType<typeof loadPortal>>["db"], viewer: Awaited<ReturnType<typeof loadPortal>>["viewer"], creator: CreatorProfile) {
  const deals = (await listDealsForViewer(db, viewer, creator.id)).filter((deal) => viewer.role === "admin" || deal.visibleToCreator);
  const payments = await listPaymentsForDeals(db, deals.map((deal) => deal.id));
  const inbox = await listInbox(db, creator.id);
  return <EarningsPanel creator={creator} deals={deals} payments={payments} inbox={inbox} />;
}

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ creator?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role === "manager") redirect("/");
  const creators = portal.viewed ? [portal.viewed] : portal.creators;
  const panels = await Promise.all(creators.map((creator) => panelFor(portal.db, portal.viewer, creator)));
  return (
    <PortalFrame viewer={portal.viewer} tab="earnings" creators={portal.creators} viewedId={portal.viewedId} hello={<Hello name={portal.viewed?.name} all={!portal.viewed} />}>
      <div className="stack">
        {creators.map((creator, index) => (
          <section key={creator.id}>
            {!portal.viewed ? <h2 style={{ marginBottom: 8 }}>{creator.name}</h2> : null}
            {panels[index]}
          </section>
        ))}
      </div>
    </PortalFrame>
  );
}

function Hello({ name, all }: { name?: string; all: boolean }) {
  return (
    <div className="hello">
      <div>
        <h1>{all ? "Earnings" : `Earnings for ${name}`}</h1>
        <p>Amounts and dates only. No bank details live here.</p>
      </div>
    </div>
  );
}
