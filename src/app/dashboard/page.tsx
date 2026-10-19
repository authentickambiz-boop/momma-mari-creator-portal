import { addReinvestmentAction, saveReinvestTargetAction } from "@/app/growth-actions";
import { PlatformInviteCard } from "@/components/platform-invite-card";
import { PortalFrame } from "@/components/portal-frame";
import { ownerDashboard } from "@/lib/campaigns";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { listPlatformInvites } from "@/lib/platform-invites";
import { REINVEST_CATEGORIES, reinvestmentSummary } from "@/lib/reinvestment";
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
  const invites = await listPlatformInvites(portal.db, portal.viewer);
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const reinvest = await reinvestmentSummary(portal.db, portal.viewer, month);
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
      {invites.map((invite) => <PlatformInviteCard key={invite.id} invite={invite} showCreator />)}
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
      {reinvest.ok ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Reinvestment</div>
          <p>{reinvest.label}</p>
          {reinvest.placeholder ? <p className="note">70% is a placeholder until you set the target you actually want.</p> : null}
          <p className="note">This is a log. Money is not moved, paid, or billed from this screen.</p>
          {reinvest.byCategory.map((row) => <p key={row.id}>{row.label}: {formatMoney(row.cents)}</p>)}
          <form action={saveReinvestTargetAction} className="stack">
            <label>Target percent<input name="percent" defaultValue={reinvest.targetPercent} inputMode="numeric" /></label>
            <button className="btn" type="submit">Save target</button>
          </form>
          <form action={addReinvestmentAction} className="stack">
            <input type="hidden" name="month" value={reinvest.month} />
            <label>
              Category
              <select name="category">
                {REINVEST_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>Amount<input name="amount" inputMode="decimal" /></label>
            <label>Note<input name="note" /></label>
            <button className="btn" type="submit">Log an amount</button>
          </form>
        </div>
      ) : null}
    </PortalFrame>
  );
}
