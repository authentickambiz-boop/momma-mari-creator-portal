import { approveReminderAction, generateInvoiceAction } from "@/app/invoice-actions";
import { PortalFrame } from "@/components/portal-frame";
import { listBrandInvoices, reminderKindLabel, stripeInvoicingEnabled } from "@/lib/brand-invoices";
import { loadPortal } from "@/lib/current-user";
import { listDealsForViewer } from "@/lib/queries";

function invoiceNote(code: string | undefined, saved: string | undefined) {
  if (saved === "stripe") return "Saved. Stripe has a draft invoice. It was not sent, and the reminders are still drafts.";
  if (saved === "approved") return "Approved. The reminder is still a draft on our side until you send it yourself. Nothing was emailed.";
  if (saved === "1") return "Saved. Stripe invoicing is off, so nothing was sent there. Reminder drafts are waiting for your approval.";
  if (code === "amount") return "Enter the invoice amount in dollars. Nothing was saved.";
  if (code === "net") return "Net days must be from 0 to 180. Nothing was saved.";
  if (code === "missing") return "That deal or reminder was not found. Nothing was saved.";
  if (code === "forbidden") return "Invoices stay with the owner.";
  return null;
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ creator?: string; error?: string; saved?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const note = invoiceNote(params.error, params.saved);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="invoices" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Invoices</h1>}>
        <p className="note">Brand invoices stay on the owner&apos;s sign-in. Nothing was sent.</p>
      </PortalFrame>
    );
  }
  const invoices = await listBrandInvoices(portal.db, portal.viewer);
  const deals = await listDealsForViewer(portal.db, portal.viewer, "all");
  const stripeOn = stripeInvoicingEnabled();
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="invoices"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Brand invoices</h1><p>One invoice per deal. Reminders are drafts at net due, 3 days later, and 7 days later. Nothing is emailed from here.</p></div></div>}
    >
      {note ? <p className="note">{note}</p> : null}
      <p className="note">{stripeOn ? "Stripe invoicing is on. Generating an invoice can create a Stripe draft. It is not finalized or sent." : "Stripe invoicing is off. A local invoice is saved, and nothing is sent to Stripe."}</p>
      <form action={generateInvoiceAction} className="card stack">
        <div className="sec-title">New invoice</div>
        <label>
          Deal
          <select name="dealId" required aria-label="Deal">
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>{deal.brand} · {deal.creatorName}</option>
            ))}
          </select>
        </label>
        <label>
          Amount in dollars, if the deal has no amount
          <input name="amount" inputMode="decimal" placeholder="1500" aria-label="Invoice amount" />
        </label>
        <label>
          Net days, if you want to override the deal terms
          <input name="netDays" inputMode="numeric" placeholder="30" aria-label="Net days" />
        </label>
        <label>
          PO number
          <input name="poNumber" aria-label="PO number" />
        </label>
        <button className="btn" type="submit">Generate invoice</button>
      </form>
      {invoices.ok && invoices.invoices.length === 0 ? <p className="note empty">No invoices yet.</p> : null}
      {invoices.ok ? invoices.invoices.map((invoice) => (
        <article key={invoice.id} className="card stack" style={{ marginTop: 14 }}>
          <div className="sec-title">{invoice.brand}</div>
          <p>{invoice.amountLabel} · Net {invoice.netDays} · Due {invoice.dueOn}{invoice.poNumber ? ` · PO ${invoice.poNumber}` : ""}</p>
          <p className="note">{invoice.stripeInvoiceId ? `Stripe draft ${invoice.stripeInvoiceId}. Not sent.` : "No Stripe invoice. Nothing was sent."}</p>
          {invoice.reminders.map((reminder) => (
            <div key={reminder.id}>
              <p><b>{reminderKindLabel(reminder.kind)}</b> · {reminder.dueOn} · {reminder.status === "approved" ? "Approved" : "Draft"} · Not sent</p>
              <p className="note">{reminder.subject}</p>
              <p>{reminder.body}</p>
              {reminder.status === "draft" ? (
                <form action={approveReminderAction}>
                  <input type="hidden" name="reminderId" value={reminder.id} />
                  <button className="btn ghost" type="submit">Approve draft</button>
                </form>
              ) : <p className="note">Approved by {reminder.approvedBy}. Still not sent.</p>}
            </div>
          ))}
        </article>
      )) : null}
    </PortalFrame>
  );
}
