import { addBrandCrmEntryAction } from "@/app/brand-actions";
import { setBrandTermsAction } from "@/app/deposit-actions";
import { PortalFrame } from "@/components/portal-frame";
import { listBrandCrm, responseLabel } from "@/lib/brand-crm";
import { listBrandBilling } from "@/lib/brand-deposits";
import { brandErrorNote } from "@/lib/brand-notes";
import { depositErrorNote } from "@/lib/deposit-notes";
import { isOwner } from "@/lib/authz";
import { formatMoney } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; brandError?: string; termsError?: string }> }) {
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
  const brandError = brandErrorNote(params.brandError);
  const termsError = depositErrorNote(params.termsError);
  const billing = owner ? await listBrandBilling(portal.db, portal.viewer, list.brands.map((card) => card.brand)) : [];
  const billingByKey = new Map(billing.map((card) => [card.key, card]));
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="brands"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><h1>Brands</h1><p>Contacts, past deals, and responses. Screening notes show up here. Amounts stay with the owner.</p></div>}
    >
      {params.saved ? <p className="note">{params.saved === "terms" ? "Billing terms saved. Nothing was emailed, and nothing switched on its own." : "Saved. Nothing was emailed."}</p> : null}
      {brandError ? <p className="private-note">{brandError}</p> : null}
      {termsError ? <p className="private-note">{termsError}</p> : null}
      {list.brands.length === 0 ? <p className="note empty">No brands on this list yet.</p> : null}
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
            {owner && billingByKey.get(card.key) ? (
              <form action={setBrandTermsAction} className="stage-form">
                <input type="hidden" name="brand" value={card.brand} />
                <p>
                  {billingByKey.get(card.key)?.terms === "net_30" ? "Net 30" : "Deposit first"}
                  {billingByKey.get(card.key)?.eligible ? " · Eligible for Net 30" : " · Not eligible for Net 30 yet"}
                </p>
                {billingByKey.get(card.key)?.lateFlag ? <p className="note">This brand paid more than 10 days late. You can move it back to deposit first. Nothing changes on its own.</p> : null}
                {billingByKey.get(card.key)?.eligible ? <button className="btn ghost" type="submit" name="terms" value="net_30">Move to Net 30</button> : <p className="note">One paid-on-time deal is required before Net 30.</p>}
                <button className="btn ghost" type="submit" name="terms" value="deposit_first">Move to deposit first</button>
              </form>
            ) : null}
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
