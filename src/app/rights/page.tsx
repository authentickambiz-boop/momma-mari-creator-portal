import { saveUsageRightsAction } from "@/app/rights-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { listDealsForViewer } from "@/lib/queries";
import { rightsErrorNote } from "@/lib/rights-notes";
import { USAGE_CHANNELS, USAGE_DAY_TIERS, listUsageRights } from "@/lib/usage";

export default async function RightsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; rightsError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const today = new Date().toISOString().slice(0, 10);
  const cards = await listUsageRights(portal.db, portal.viewer, today);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  const owner = portal.viewer.role === "admin";
  const deals = staff ? await listDealsForViewer(portal.db, portal.viewer, portal.viewedId) : [];
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="rights"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><h1>Usage rights</h1><p>Licenses nearing the end get a flag and a suggested renewal. Nothing is charged.</p></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed or charged.</p> : null}
      {rightsErrorNote(params.rightsError) ? <p className="private-note">{rightsErrorNote(params.rightsError)}</p> : null}
      {cards.length === 0 ? <p className="note empty">No usage windows yet.</p> : null}
      {cards.length > 0 ? (
        <div className="card">
          <table>
            <thead><tr><th>Brand</th><th>Tier</th><th>Channels</th><th>Usage</th><th>Starts</th><th>Ends</th><th>Exclusivity</th><th>Flag</th><th>Suggested renewal</th></tr></thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.dealId}>
                  <td>{card.brand}</td>
                  <td>{card.tierLabel}</td>
                  <td>{card.channelsLabel}</td>
                  <td>{card.usageType ?? "Not set"}{card.territory ? ` · ${card.territory}` : ""}</td>
                  <td>{card.startsOn}</td>
                  <td>{card.endsOn ?? "No end"}</td>
                  <td>{card.exclusivityCategory ?? "None"}{card.exclusivityEndsOn ? ` · ends ${card.exclusivityEndsOn}` : ""}</td>
                  <td>{card.flag === "soon" ? "Nearing expiry" : card.flag === "expired" ? "Expired" : "In term"}</td>
                  <td>{card.renewalSku} · {card.renewalLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Renewal ideas are B-UA, B-UA90, B-UA12, and B-UAP. Nothing is charged from this page.</p>
        </div>
      ) : null}
      {staff ? (
        <form action={saveUsageRightsAction} className="card stack" style={{ marginTop: 14 }}>
          <div className="sec-title">Set a usage window</div>
          <label>Deal
            <select name="dealId" required defaultValue={deals[0]?.id ?? ""}>
              {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.brand}</option>)}
            </select>
          </label>
          <label>Tier
            <select name="tier" defaultValue="30" required>
              {USAGE_DAY_TIERS.map((days) => <option key={days} value={days}>{days} days</option>)}
              {owner ? <option value="perpetual">Perpetual, owner only</option> : null}
            </select>
          </label>
          <fieldset>
            <legend>Channels</legend>
            {USAGE_CHANNELS.map((channel) => (
              <label key={channel.id}>
                <input type="checkbox" name="channels" value={channel.id} defaultChecked={channel.id === "organic_repost"} /> {channel.label}
              </label>
            ))}
          </fieldset>
          <label>Usage type
            <select name="usageType" defaultValue="organic">
              <option value="organic">Organic</option>
              <option value="paid">Paid ads</option>
              <option value="whitelisting">Whitelisting / Spark</option>
            </select>
          </label>
          <label>Territory<input name="territory" placeholder="US, or worldwide" /></label>
          <label>Starts<input type="date" name="startsOn" required /></label>
          <label>Exclusivity category<input name="exclusivityCategory" placeholder="Towel warmers, or none" /></label>
          <label>Exclusivity ends<input type="date" name="exclusivityEndsOn" /></label>
          {owner ? <label>Renewal fee, optional<input name="renewalFee" inputMode="decimal" placeholder="Leave blank to skip" /></label> : null}
          <p className="note">The end date is the start date plus the tier. Perpetual usage stays off unless the owner turns it on. A renewal fee, when you enter one, is recorded like any other deal: 80% creator and 20% agency. Nothing is emailed or charged.</p>
          <button className="btn" type="submit">Save usage</button>
        </form>
      ) : null}
    </PortalFrame>
  );
}
