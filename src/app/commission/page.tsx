import { showCommissionInterestAction } from "@/app/commission-actions";
import { PortalFrame } from "@/components/portal-frame";
import { creatorIsOpenRoster, listOpenCommissionCampaigns } from "@/lib/commission-campaigns";
import { commissionErrorNote } from "@/lib/commission-notes";
import { loadPortal } from "@/lib/current-user";

export default async function CommissionPage({ searchParams }: { searchParams: Promise<{ saved?: string; commissionError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const note = commissionErrorNote(params.commissionError);
  if (portal.viewer.role !== "creator" || !portal.viewer.creatorId) {
    return (
      <PortalFrame viewer={portal.viewer} tab="commission" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Commission</h1>}>
        <p className="note">Commission campaigns are on the creator sign-in. Interest counts are on the owner dashboard.</p>
      </PortalFrame>
    );
  }
  const campaigns = await listOpenCommissionCampaigns(portal.db, portal.viewer);
  const openRoster = await creatorIsOpenRoster(portal.db, portal.viewer.creatorId);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="commission"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>Commission</h1>
            <p>{openRoster
              ? "Open commission and affiliate campaigns for the free bench and creators who are not exclusive. Rate is TBD. Nothing is emailed when you show interest."
              : "Open commission and affiliate campaigns. Rate is TBD. Nothing is emailed when you show interest."}</p>
          </div>
        </div>
      }
    >
      {note ? <p className="private-note">{note}</p> : null}
      {params.saved === "1" ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {campaigns.length === 0 ? <p className="note empty">No open campaigns yet.</p> : null}
      {campaigns.map((campaign) => (
        <article key={campaign.id} className="card stack" style={{ marginBottom: 14 }}>
          <h2>{campaign.brand}</h2>
          <p><b>{campaign.title}</b></p>
          <p>{campaign.description}</p>
          <p>{campaign.terms}</p>
          <p className="note">Rate {campaign.rate}</p>
          <p className="note">{campaign.trackingPending ? "Tracking link pending." : campaign.trackingLink}</p>
          <p className="note">{campaign.bonusPending ? "Bonus pending." : `Bonus: ${campaign.bonus}`}</p>
          {campaign.interested ? (
            <p className="note">You showed interest.</p>
          ) : (
            <form action={showCommissionInterestAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button className="btn" type="submit">Show interest</button>
            </form>
          )}
        </article>
      ))}
    </PortalFrame>
  );
}
