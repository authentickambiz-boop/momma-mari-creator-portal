import { saveUsageRightsAction } from "@/app/rights-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { listDealsForViewer } from "@/lib/queries";
import { listUsageRights } from "@/lib/usage";

export default async function RightsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; rightsError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const today = new Date().toISOString().slice(0, 10);
  const cards = await listUsageRights(portal.db, portal.viewer, today);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
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
      {params.rightsError ? <p className="private-note">{params.rightsError}</p> : null}
      {cards.length === 0 ? <p className="note">No usage windows yet.</p> : null}
      {cards.length > 0 ? (
        <div className="card">
          <table>
            <thead><tr><th>Brand</th><th>Starts</th><th>Ends</th><th>Flag</th><th>Suggested renewal</th></tr></thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.dealId}>
                  <td>{card.brand}</td>
                  <td>{card.startsOn}</td>
                  <td>{card.endsOn ?? "No end"}</td>
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
          <label>Starts<input type="date" name="startsOn" required /></label>
          <label>Ends<input type="date" name="endsOn" /></label>
          <p className="note">Leave the end empty for perpetual usage (B-UAP).</p>
          <button className="btn" type="submit">Save usage</button>
        </form>
      ) : null}
    </PortalFrame>
  );
}
