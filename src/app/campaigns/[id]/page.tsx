import Link from "next/link";
import { allocateCampaignAction, markOutsideAction, queueOutsideOfferAction, saveCampaignGoalAction } from "@/app/campaign-actions";
import { PortalFrame } from "@/components/portal-frame";
import {
  allocationsFor,
  campaignById,
  canSeeCommission,
  canSeeMoney,
  listOutsideOffers,
  listProspects,
  presentRoster,
  projectedCommission,
  rankRoster,
  rosterHasAFit,
} from "@/lib/campaigns";
import { formatGoalTarget, goalTypeLabel, RECAP_GOAL_TYPES } from "@/lib/brand-recap-report";
import { campaignErrorNote } from "@/lib/campaign-notes";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creator?: string; saved?: string; queued?: string; campaignError?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(query.creator ?? null);
  const campaign = await campaignById(portal.db, id);
  if (!campaign || portal.viewer.role === "creator") {
    return (
      <PortalFrame viewer={portal.viewer} tab="campaigns" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Campaign</h1>}>
        <p className="note">That campaign is not on your list.</p>
      </PortalFrame>
    );
  }
  const ranked = presentRoster(portal.viewer, await rankRoster(portal.db, campaign));
  const allocations = await allocationsFor(portal.db, campaign.id);
  const offers = await listOutsideOffers(portal.db, campaign.id);
  const prospects = portal.viewer.role === "admin" ? await listProspects(portal.db) : [];
  const priced = canSeeMoney(portal.viewer);
  const commission = canSeeCommission(portal.viewer) ? projectedCommission(allocations.map((row) => row.amountCents)) : null;
  const names = new Map(ranked.map((row) => [row.creatorId, row.name]));
  const campaignError = campaignErrorNote(query.campaignError);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="campaigns"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>{campaign.brand}</h1><p>{campaign.name}. Roster creators are ranked first, best fit and highest ask at the top.</p></div></div>}
    >
      {query.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {query.queued ? <p className="note">The offer is in the approval queue. Nothing was sent.</p> : null}
      {campaignError ? <p className="private-note">{campaignError}</p> : null}
      <div className="card">
        <p>{campaign.niches.join(", ") || "Any niche"} · {campaign.platforms.join(", ") || "Any platform"} · {campaign.deliverables.join(", ") || "Deliverables TBD"}</p>
        <p>{campaign.slots} creator slots · {campaign.status}{campaign.openOutside ? " · Open to outside creators" : ""}</p>
        {priced ? <p>Budget {formatMoney(campaign.budgetCents)}</p> : <p className="note">The budget stays with the owner unless your pricing toggle is on.</p>}
        {campaign.startsOn || campaign.endsOn ? <p>{campaign.startsOn || "Start TBD"} to {campaign.endsOn || "End TBD"}</p> : null}
        {goalTypeLabel(campaign.goalType ?? "") && campaign.goalTarget ? (
          <p>Kickoff goal: {formatGoalTarget(campaign.goalTarget)} {goalTypeLabel(campaign.goalType ?? "")?.toLowerCase()}</p>
        ) : <p className="note">No kickoff goal yet.</p>}
        {portal.viewer.role === "admin" ? (
          <form action={saveCampaignGoalAction} className="stage-form">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <label>Kickoff goal
              <select name="goalType" defaultValue={campaign.goalType ?? ""}>
                <option value="">No goal yet</option>
                {RECAP_GOAL_TYPES.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}
              </select>
            </label>
            <label>Target number<input name="goalTarget" inputMode="numeric" defaultValue={campaign.goalTarget ?? ""} placeholder="100000" /></label>
            <button className="btn" type="submit">Save kickoff goal</button>
          </form>
        ) : null}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Roster match</div>
        {ranked.length === 0 ? <p className="note empty">No creator on the roster matches this campaign yet.</p> : null}
        {ranked.map((row) => (
          <p key={row.creatorId}>
            <b>{row.name}</b> · fit <span className="match-score">{row.score}</span> · {row.verdictLabel}
            {portal.viewer.role === "admin" && row.rosterRank ? <> · roster rank {row.rosterRank}</> : null}
            {priced && row.askCents ? <> · ask {formatMoney(row.askCents)}</> : null}
          </p>
        ))}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Budget split</div>
        {allocations.length ? allocations.map((row) => (
          <p key={row.id}>{names.get(row.creatorId ?? "") ?? "Creator"}{priced ? ` · ${formatMoney(row.amountCents)}` : ""}</p>
        )) : <p className="note empty">No creators are assigned yet.</p>}
        {commission != null ? <p>Projected commission {formatMoney(commission)} (20%)</p> : null}
        {campaign.kind === "offer" ? <p className="note">This is a brand offer. <Link href="/offers">Open brand offers</Link> to change who receives it.</p> : null}
        {campaign.kind !== "offer" && portal.viewer.role === "admin" && ranked.length > 0 ? (
          <form action={allocateCampaignAction} className="stack">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <label>
              Creator
              <select name="creatorId">
                {ranked.map((row) => <option key={row.creatorId} value={row.creatorId}>{row.name}</option>)}
              </select>
            </label>
            <label>Amount<input name="amount" inputMode="decimal" /></label>
            <button className="btn" type="submit">Add to this campaign</button>
          </form>
        ) : null}
      </div>
      {campaign.kind !== "offer" && portal.viewer.role === "admin" && !rosterHasAFit(ranked) && !campaign.openOutside ? (
        <form action={markOutsideAction} className="card stack" style={{ marginTop: 14 }}>
          <input type="hidden" name="campaignId" value={campaign.id} />
          <p>No roster creator clears her rules for this budget. You can use it as a recruiting offer.</p>
          <button className="btn" type="submit">Open to outside creators</button>
        </form>
      ) : null}
      {campaign.kind !== "offer" && portal.viewer.role === "admin" && campaign.openOutside ? (
        <form action={queueOutsideOfferAction} className="card stack" style={{ marginTop: 14 }}>
          <input type="hidden" name="campaignId" value={campaign.id} />
          <div className="sec-title">Recruiting offer</div>
          <p className="note">This writes a draft in Approvals. It is not emailed.</p>
          {prospects.length === 0 ? (
            <p className="note">Add a prospect before you queue an offer. <Link href="/prospects">Open prospects</Link>. Nothing is emailed.</p>
          ) : (
            <>
              <label>
                Prospect
                <select name="prospectId">
                  {prospects.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              </label>
              <label>Amount<input name="amount" inputMode="decimal" /></label>
              <button className="btn" type="submit">Queue the offer</button>
            </>
          )}
          {offers.length ? <p>{offers.length} outside offer{offers.length === 1 ? "" : "s"} queued.</p> : null}
        </form>
      ) : null}
    </PortalFrame>
  );
}
