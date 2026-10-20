import { addBrandCrmEntryAction } from "@/app/brand-actions";
import { PortalFrame } from "@/components/portal-frame";
import { listBrandCrm, responseLabel } from "@/lib/brand-crm";
import { isOwner } from "@/lib/authz";
import { formatMoney } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; brandError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const list = await listBrandCrm(portal.db, portal.viewer);
  if (!list.ok) {
    return (
      <PortalFrame viewer={portal.viewer} tab="deals" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brands</h1>}>
        <p className="note">The brand list is for the team.</p>
      </PortalFrame>
    );
  }
  const owner = isOwner(portal.viewer);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="brands"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><h1>Brands</h1><p>Contacts, past deals, and responses. Screening notes show up here. Amounts stay with the owner.</p></div>}
    >
      {params.saved ? <p className="note">Saved.</p> : null}
      {params.brandError ? <p className="private-note">{params.brandError}</p> : null}
      {list.brands.length === 0 ? <p className="note">No brands on this list yet.</p> : null}
      <div className="stack">
        {list.brands.map((card) => (
          <article key={card.key} className="card">
            <b>{card.brand}</b>
            <ul>
              {card.deals.map((deal) => (
                <li key={deal.id}>
                  {deal.creatorName} · {deal.workflowStage ?? deal.status}
                  {owner && deal.rateCents != null ? ` · ${formatMoney(deal.rateCents)}` : ""}
                  {owner && deal.amountDisplay ? ` · ${deal.amountDisplay}` : ""}
                </li>
              ))}
            </ul>
            {card.contacts.length > 0 ? (
              <p>{card.contacts.map((contact) => contact.email || contact.name).filter(Boolean).join(" · ")}</p>
            ) : <p className="note">No contact yet.</p>}
            {card.screenings.length > 0 ? (
              <p className="note">Screening: {card.screenings.map((row) => row.note || row.decision).join("; ")}</p>
            ) : null}
            {card.responses.length > 0 ? (
              <p>Responses: {card.responses.map((row) => responseLabel(row.decision)).join(", ")}</p>
            ) : <p className="note">No response yet.</p>}
            {card.responses.some((row) => row.note) ? (
              <p className="note">{card.responses.map((row) => row.note).filter(Boolean).join(" · ")}</p>
            ) : null}
            {card.crm.map((row, index) => (
              <p key={`${row.creatorId ?? "brand"}-${index}`}>
                {row.creatorName ?? "No creator yet"} · {row.outcome ?? "Open"}
                {owner && row.ratePaidCents != null ? ` · ${formatMoney(row.ratePaidCents)} paid` : ""}
                {row.nextFollowUp ? ` · Follow-up ${row.nextFollowUp}` : ""}
              </p>
            ))}
            {owner ? (
              <form action={addBrandCrmEntryAction} className="stage-form">
                <input type="hidden" name="brand" value={card.brand} />
                <input type="hidden" name="kind" value="response" />
                <label>Response
                  <select name="response" aria-label={`Response for ${card.brand}`} defaultValue="no_reply">
                    <option value="interested">Interested</option>
                    <option value="declined">Declined</option>
                    <option value="no_reply">No reply</option>
                    <option value="negotiating">Negotiating</option>
                  </select>
                </label>
                <label>Note<input name="note" placeholder="What they said" /></label>
                <button className="btn ghost" type="submit">Save response</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </PortalFrame>
  );
}
