import { approveCreatorApplicationAction, declineCreatorApplicationAction } from "@/app/apply-actions";
import { setCreatorSignedAction } from "@/app/billing-actions";
import { addReinvestmentAction, saveReinvestTargetAction } from "@/app/growth-actions";
import { PlatformInviteCard } from "@/components/platform-invite-card";
import { GiftGuideReservationsPanel } from "@/components/gift-guide-reservations";
import { OwnerSignals } from "@/components/owner-signals";
import { OwnerTasks } from "@/components/owner-tasks";
import { PipelineFollowUps } from "@/components/pipeline-follow-ups";
import { PortalFrame } from "@/components/portal-frame";
import { ownerDashboard } from "@/lib/campaigns";
import { pipelineReminders, seedBrandPipeline } from "@/lib/brand-pipeline";
import { BRAND_CREDIT } from "@/lib/branding";
import { fulfillmentStatusLabel, listFulfillmentOrders } from "@/lib/fulfillment-orders";
import { paymentsEnabled } from "@/lib/payments";
import { MEMBER_ONE_TIME_PERCENT_OFF, memberServiceIncluded } from "@/lib/payments-config";
import { applyReviewNote, listCreatorApplications, type CreatorApplicationView } from "@/lib/creator-apply";
import { listBrandReports } from "@/lib/brand-report";
import { listDueBrandRecaps, queueBrandRecapDrafts } from "@/lib/brand-recap";
import { listCommissionCampaignsForOwner } from "@/lib/commission-campaigns";
import { listGiftGuideReservations } from "@/lib/gift-guide";
import { listOwnerDealReviews } from "@/lib/creator-deal-review";
import { listOwnerTasks } from "@/lib/creator-tasks";
import { CREATOR_NICHES, listAdminRoster, nicheIdFromInput, rosterMatchesNiche } from "@/lib/creator-niches";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { growthErrorNote } from "@/lib/growth-notes";
import { inviteErrorNote } from "@/lib/invite-notes";
import { listPlatformInvites } from "@/lib/platform-invites";
import { REINVEST_CATEGORIES, reinvestmentSummary } from "@/lib/reinvestment";
import { getDealStage } from "@/lib/stages";
import { listUsageEndingSoon, listUsageRights, usageExpiryAlerts } from "@/lib/usage";
import { queueUsageRenewalDrafts } from "@/lib/usage-renewal";
import { syncPostedUsageNotices } from "@/lib/usage-extension";
import { listDealsForViewer } from "@/lib/queries";
import { listCreatorSigning, signedCreatorNote } from "@/lib/signed-creators";

function ApplicationsCard({ applications, note }: { applications: CreatorApplicationView[]; note: string | null }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Applications</div>
      <p className="note">New applications show up here. Nothing is emailed. Paid signup is not wired. Stripe stays off. Nothing is charged.</p>
      {note ? <p className="note">{note}</p> : null}
      {applications.length === 0 ? <p className="note empty">No applications yet.</p> : null}
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

function FulfillmentCard({ orders, enabled }: { orders: Awaited<ReturnType<typeof listFulfillmentOrders>>; enabled: boolean }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Fulfillment</div>
      {enabled ? (
        <>
          <p className="note">Paid one-time orders wait here. A bot claims one, then delivers a file or a link. Delivered work carries the Momma Mari logo and {BRAND_CREDIT}.</p>
          {orders.length === 0 ? <p className="note empty">No orders yet.</p> : (
            <table className="fulfillment-table">
              <thead><tr><th>Creator</th><th>Product</th><th>Status</th><th>Created</th><th>Due</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.creatorName}</td>
                    <td>{order.productName}</td>
                    <td>{fulfillmentStatusLabel(order.status)}</td>
                    <td>{order.createdAt.slice(0, 10)}</td>
                    <td>{order.dueOn}{order.deliveryUrl ? <> · <a href={order.deliveryUrl}>Delivery</a></> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p className="note">Payments are off. One-time orders are not queued, and the bot cannot claim them.</p>
      )}
    </div>
  );
}

function SignedCreatorsCard({ people }: { people: Awaited<ReturnType<typeof listCreatorSigning>> }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Signed creators</div>
      <p className="note">A signed creator gets media kits, rate cards, contract reviews, and starter kits included. {memberServiceIncluded(MEMBER_ONE_TIME_PERCENT_OFF.business) ? "An active Business member gets the same services included." : `Business members get ${MEMBER_ONE_TIME_PERCENT_OFF.business}% off.`} The request goes to the queue and does not open Checkout. Plus members get {MEMBER_ONE_TIME_PERCENT_OFF.plus}% off. Pro members get {MEMBER_ONE_TIME_PERCENT_OFF.pro}% off.</p>
      {people.length === 0 ? <p className="note empty">No creators yet.</p> : (
        <table>
          <thead><tr><th>Creator</th><th>Contract</th><th></th></tr></thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>{person.signed ? "Signed" : "Not signed"}</td>
                <td>
                  <form action={setCreatorSignedAction}>
                    <input type="hidden" name="creatorId" value={person.id} />
                    <input type="hidden" name="signed" value={person.signed ? "0" : "1"} />
                    <button className="btn ghost" type="submit">{person.signed ? "Clear signed" : "Mark signed"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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

const TODO_NOTES: Record<string, string> = {
  role: "You can't edit these to-dos.",
  missing: "That to-do is not on your list.",
  title: "Add a title.",
  category: "Choose a category.",
  status: "Choose a status.",
  date: "Due date must be a real day like 2026-11-20.",
  "1": "That to-do was not saved.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ creator?: string; growthError?: string; saved?: string; invite?: string; apply?: string; applyError?: string; signed?: string; todo?: string; niche?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const inviteNote = inviteErrorNote(params.invite);
  const signedNote = signedCreatorNote(params.signed);
  const notices = <DashboardNotices growthError={params.growthError} saved={params.saved} />;
  const applyNote = params.apply === "approved" || params.apply === "declined"
    ? applyReviewNote(params.apply)
    : applyReviewNote(params.applyError);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Dashboard</h1>}>
        {notices}
        {inviteNote ? <p className="private-note">{inviteNote}</p> : null}
        {signedNote ? <p className="private-note" role="alert">{signedNote}</p> : null}
        <p className="note">Pipeline value, commission, and win rate stay on the owner&apos;s sign-in.</p>
      </PortalFrame>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  await queueUsageRenewalDrafts(portal.db, today);
  await syncPostedUsageNotices(portal.db, today);
  await queueBrandRecapDrafts(portal.db, today);
  const usageCards = await listUsageRights(portal.db, portal.viewer, today);
  const endingSoon = await listUsageEndingSoon(portal.db, portal.viewer, today);
  const reviewBoard = await listOwnerDealReviews(portal.db, portal.viewer);
  const signals = (
    <OwnerSignals
      alerts={usageExpiryAlerts(usageCards, today)}
      endingSoon={endingSoon}
      reviews={reviewBoard.ok ? reviewBoard.reviews : []}
      reports={await listBrandReports(portal.db, portal.viewer)}
      recaps={await listDueBrandRecaps(portal.db, portal.viewer, today)}
      deals={(await listDealsForViewer(portal.db, portal.viewer, "all")).map((deal) => ({ id: deal.id, brand: deal.brand }))}
    />
  );
  const orders = await listFulfillmentOrders(portal.db, portal.viewer);
  const signing = await listCreatorSigning(portal.db, portal.viewer);
  const taskBoard = await listOwnerTasks(portal.db, portal.viewer);
  const taskNote = params.todo ? TODO_NOTES[params.todo] ?? TODO_NOTES["1"] : null;
  const taskCard = <OwnerTasks tasks={taskBoard.ok ? taskBoard.tasks : []} note={taskNote} />;
  const paymentsOn = paymentsEnabled();
  const dash = await ownerDashboard(portal.db, portal.viewer);
  const applications = await listCreatorApplications(portal.db, portal.viewer);
  const commissionBoard = await listCommissionCampaignsForOwner(portal.db, portal.viewer);
  const commissionCard = (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Commission campaigns</div>
      <p className="note">Open and closed commission campaigns. The rate stays TBD. Interest is a count. Nothing is emailed.</p>
      {!commissionBoard.ok ? <p className="note">{commissionBoard.error}</p> : commissionBoard.campaigns.length === 0 ? <p className="note empty">No commission campaigns yet.</p> : (
        <ul>
          {commissionBoard.campaigns.map((campaign) => (
            <li key={campaign.id}>
              {campaign.brand} · {campaign.title} · {campaign.status} · {campaign.interestCount} {campaign.interestCount === 1 ? "creator" : "creators"} interested
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const giftGuide = await listGiftGuideReservations(portal.db, portal.viewer);
  const giftGuideCard = giftGuide.ok
    ? <GiftGuideReservationsPanel summary={giftGuide.summary} reservations={giftGuide.reservations} />
    : (
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Gift guide reservations</div>
        <p className="note">{giftGuide.error}</p>
      </div>
    );
  const invites = await listPlatformInvites(portal.db, portal.viewer);
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const reinvest = await reinvestmentSummary(portal.db, portal.viewer, month);
  await seedBrandPipeline(portal.db, portal.viewer);
  const followUps = await pipelineReminders(portal.db, portal.viewer);
  const followUpCard = <PipelineFollowUps reminders={followUps.ok ? followUps.reminders : []} />;
  if (!dash.ok) {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Dashboard</h1>}>
        {notices}
        {inviteNote ? <p className="private-note">{inviteNote}</p> : null}
        {signedNote ? <p className="private-note" role="alert">{signedNote}</p> : null}
        <ApplicationsCard applications={applications} note={applyNote} />
        {commissionCard}
        {giftGuideCard}
        {taskCard}
        {signals}
        <FulfillmentCard orders={orders} enabled={paymentsOn} />
        <SignedCreatorsCard people={signing} />
        {followUpCard}
        <p className="note">{dash.error}</p>
      </PortalFrame>
    );
  }
  const nicheFilter = nicheIdFromInput(params.niche ?? "");
  const roster = await listAdminRoster(portal.db);
  const rosterRows = nicheFilter ? roster.filter((row) => rosterMatchesNiche(row, nicheFilter)) : roster;
  const openDeals = new Map(dash.utilization.map((row) => [row.creatorId, row]));
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
      {signedNote ? <p className="private-note" role="alert">{signedNote}</p> : null}
      <ApplicationsCard applications={applications} note={applyNote} />
      {commissionCard}
      {giftGuideCard}
      {taskCard}
      {signals}
      <FulfillmentCard orders={orders} enabled={paymentsOn} />
      <SignedCreatorsCard people={signing} />
      {followUpCard}
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
        <form method="get" className="stack">
          <label>
            Niche
            <select name="niche" defaultValue={nicheFilter ?? ""}>
              <option value="">All niches</option>
              {CREATOR_NICHES.map((niche) => <option key={niche.id} value={niche.id}>{niche.label}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Filter</button>
        </form>
        <table>
          <thead><tr><th>Creator</th><th>Niches</th><th>Open deals</th><th>Meets bar</th></tr></thead>
          <tbody>
            {rosterRows.map((row) => {
              const open = openDeals.get(row.creatorId);
              return (
                <tr key={row.creatorId}>
                  <td>{row.name}</td>
                  <td>{row.niches.join(", ") || "—"}</td>
                  <td>{open ? `${open.openDeals} open of ${open.maxDeals} a month` : "—"}</td>
                  <td>{row.meetsBar ? "Meets bar" : ""}</td>
                </tr>
              );
            })}
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
