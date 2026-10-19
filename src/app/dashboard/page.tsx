import { PortalFrame } from "@/components/portal-frame";
import { ownerDashboard } from "@/lib/campaigns";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { getDealStage } from "@/lib/stages";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ creator?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Dashboard</h1>}>
        <p className="note">Pipeline value, commission, and win rate stay on the owner's sign-in.</p>
      </PortalFrame>
    );
  }
  const dash = await ownerDashboard(portal.db, portal.viewer);
  if (!dash.ok) {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Dashboard</h1>}>
        <p className="note">{dash.error}</p>
      </PortalFrame>
    );
  }
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="dashboard"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Dashboard</h1><p>What the roster is worth, and where a campaign still needs a creator.</p></div></div>}
    >
      <div className="card">
        <div className="sec-title">Pipeline</div>
        {dash.pipeline.map((row) => (
          <p key={row.stage}>{getDealStage(row.stage)?.adminLabel ?? row.stage}: {formatMoney(row.cents)}</p>
        ))}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Expected commission</div>
        <p>This month {formatMoney(dash.commissionThisMonth)}</p>
        <p>Next month {formatMoney(dash.commissionNextMonth)}</p>
        <p>Win rate {dash.winRate == null ? "No decisions yet" : `${Math.round(dash.winRate * 100)}%`} ({dash.won} won, {dash.lost} declined)</p>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Average deal</div>
        {dash.averageByCreator.map((row) => <p key={row.creatorId}>{row.name}: {formatMoney(row.cents)}</p>)}
        {dash.averageByNiche.map((row) => <p key={row.niche}>{row.niche}: {formatMoney(row.cents)}</p>)}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Roster</div>
        {dash.utilization.map((row) => <p key={row.creatorId}>{row.name}: {row.openDeals} open of {row.maxDeals} a month</p>)}
        <p>Unfilled campaign slots: {dash.unfilledSlots}</p>
        <p>Outside creators: {dash.converted} of {dash.prospects} prospects on the roster, {dash.outsideOffers} offers queued.</p>
      </div>
    </PortalFrame>
  );
}
