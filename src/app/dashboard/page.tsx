import { approveCreatorApplicationAction, declineCreatorApplicationAction } from "@/app/apply-actions";
import { addReinvestmentAction, saveReinvestTargetAction } from "@/app/growth-actions";
import { PlatformInviteCard } from "@/components/platform-invite-card";
import { PortalFrame } from "@/components/portal-frame";
import { ownerDashboard } from "@/lib/campaigns";
import { applyReviewNote, listCreatorApplications, type CreatorApplicationView } from "@/lib/creator-apply";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { growthErrorNote } from "@/lib/growth-notes";
import { inviteErrorNote } from "@/lib/invite-notes";
import { listPlatformInvites } from "@/lib/platform-invites";
import { REINVEST_CATEGORIES, reinvestmentSummary } from "@/lib/reinvestment";
import { getDealStage } from "@/lib/stages";

function ApplicationsCard({ applications, note }: { applications: CreatorApplicationView[]; note: string | null }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Applications</div>
      <p className="note">New applications show up here. Nothing is emailed. Paid signup is not wired. Stripe stays off. Nothing is charged.</p>
      {note ? <p className="note">{note}</p> : null}
      {applications.length === 0 ? <p>No applications yet.</p> : null}
      {applications.map((application) => (
        <div key={application.id} className="card" style={{ marginTop: 10 }}>
          <p><b>{application.name}</b> · {application.status}</p>
          <p>{application.email}</p>
          <p>Handles: {application.handles}</p>
          <p>Followers: {application.followers}</p>
          <p>Niche: {application.niche}</p>
          {application.rates ? <p>Rates: {application.rates}</p> : <p className="note">No rates given.</p>}
          <p>{application.message}</p>
          {application.status === "pending" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <form action={approveCreatorApplicationAction}>
                <input type="hidden" name="id" value={application.id} />
                <button className="btn" type="submit">Approve</button>
              </form>
              <form action={declineCreatorApplicationAction}>
                <input type="hidden" name="id" value={application.id} />
                <button className="btn ghost" type="submit">Decline</button>
              </form>
            </div>
          ) : application.invitedAt ? <p className="note">She can sign in with this email. Nothing was emailed.</p> : null}
        </div>
      ))}
    </div>
  );
}

function DashboardNotices({ growthError, saved }: { growthError?: string; saved?: string }) {
  const note = growthErrorNote(growthError);
  return (
    <>
      {note ? <p className="private-note">{note}</p> : null}
      {saved ? <p className="note">Saved. Nothing was paid or billed.</p> : null}
    </>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ creator?: string; growthError?: string; saved?: string; invite?: string; apply?: string; applyError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const inviteNote = inviteErrorNote(params.invite);
  const notices = <DashboardNotices growthError={params.growthError} saved={params.saved} />;
  const applyNote = params.apply === "approved" || params.apply === "declined"
    ? applyReviewNote(params.apply)
    : applyReviewNote(params.applyError);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Dashboard</h1>}>
        {notices}
        {inviteNote ? <p className="private-note">{inviteNote}</p> : null}
        <p className="note">Pipeline value, commission, and win rate stay on the owner's sign-in.</p>
      </PortalFrame>
    );
  }
  const dash = await ownerDashboard(portal.db, portal.viewer);
  const applications = await listCreatorApplications(portal.db, portal.viewer);
  const invites = await listPlatformInvites(portal.db, portal.viewer);
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const reinvest = await reinvestmentSummary(portal.db, portal.viewer, month);
  if (!dash.ok) {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Dashboard</h1>}>
        {notices}
        {inviteNote ? <p className="private-note">{inviteNote}</p> : null}
        <ApplicationsCard applications={applications} note={applyNote} />
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
      {notices}
      {inviteNote ? <p className="private-note">{inviteNote}</p> : null}
      <ApplicationsCard applications={applications} note={applyNote} />
      {invites.map((invite) => <PlatformInviteCard key={invite.id} invite={invite} showCreator />)}
      <div className="kpi-row">
        <article className="kpi">
          <p className="caption">Expected commission</p>
          <b>{formatMoney(dash.commissionThisMonth)}</b>
          <p className="caption">This month</p>
        </article>
        <article className="kpi">
          <p className="caption">Expected commission</p>
          <b>{formatMoney(dash.commissionNextMonth)}</b>
          <p className="caption">Next month</p>
        </article>
        <article className="kpi">
          <p className="caption">Win rate</p>
          <b>{dash.winRate == null ? "No decisions yet" : `${Math.round(dash.winRate * 100)}%`}</b>
          <p className="caption">{dash.won} won, {dash.lost} declined</p>
        </article>
        <article className="kpi">
          <p className="caption">Unfilled slots</p>
          <b>{dash.unfilledSlots}</b>
          <p className="caption">Campaigns still needing a creator</p>
        </article>
      </div>
      <div className="card">
        <div className="sec-title">Pipeline</div>
        <table>
          <thead><tr><th>Stage</th><th>Value</th></tr></thead>
          <tbody>
            {dash.pipeline.map((row) => (
              <tr key={row.stage}>
                <td>{getDealStage(row.stage)?.adminLabel ?? row.stage}</td>
                <td>{formatMoney(row.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Average deal</div>
        <table>
          <tbody>
            {dash.averageByCreator.map((row) => <tr key={row.creatorId}><td>{row.name}</td><td>{formatMoney(row.cents)}</td></tr>)}
            {dash.averageByNiche.map((row) => <tr key={row.niche}><td>{row.niche}</td><td>{formatMoney(row.cents)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Roster</div>
        <table>
          <thead><tr><th>Creator</th><th>Open deals</th></tr></thead>
          <tbody>
            {dash.utilization.map((row) => (
              <tr key={row.creatorId}><td>{row.name}</td><td>{row.openDeals} open of {row.maxDeals} a month</td></tr>
            ))}
          </tbody>
        </table>
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
