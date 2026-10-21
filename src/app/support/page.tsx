import { submitSupportAction } from "@/app/account-actions";
import { replyTicketAction } from "@/app/ticket-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PortalFrame } from "@/components/portal-frame";
import { supportErrorNote } from "@/lib/account-notes";
import { listSupportMessages } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";
import { listSupportTickets, TICKET_STATUSES } from "@/lib/support-tickets";
import { ticketErrorNote } from "@/lib/ticket-notes";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ saved?: string; supportError?: string; ticketError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const notes = await listSupportMessages(portal.db, portal.viewer);
  const tickets = await listSupportTickets(portal.db, portal.viewer);
  const supportError = supportErrorNote(params.supportError);
  const ticketError = ticketErrorNote(params.ticketError);
  return (
    <PortalFrame viewer={portal.viewer} tab="support" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Support</h1><p>This stays in the portal. Nothing is emailed until someone sends it on purpose.</p></div>}>
      {params.saved ? <p className="note">Saved in the portal. Nothing was sent.</p> : null}
      {supportError ? <p className="private-note">{supportError}</p> : null}
      {ticketError ? <p className="private-note">{ticketError}</p> : null}
      <form action={submitSupportAction} className="card stack">
        <label>Subject<input name="subject" required maxLength={140} /></label>
        <label>Message<textarea name="body" required rows={5} maxLength={4000} /></label>
        <PrivacyNotice />
        <button className="btn" type="submit">Save note</button>
      </form>
      {notes.length === 0 ? <p className="note empty">No notes yet. Nothing is emailed.</p> : (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">{portal.viewer.role === "admin" ? "Notes in the portal" : "Your notes"}</div>
          <ul className="timeline">
            {notes.map((note) => (
              <li key={note.id}>
                <b>{note.subject}</b>
                <div className="note">{note.authorName} · {note.body}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">{portal.viewer.role === "admin" ? "Tickets" : "Your tickets"}</div>
        {tickets.length === 0 ? <p className="note">No tickets yet. Nothing is emailed.</p> : tickets.map((ticket) => (
          <article key={ticket.id}>
            <h2>{ticket.subject}</h2>
            <p className="note">{ticket.category} · {ticket.priority} · {ticket.status}</p>
            <ul className="timeline">
              {ticket.replies.map((reply) => (
                <li key={reply.id}><b>{reply.authorName}</b><div className="note">{reply.body}</div></li>
              ))}
            </ul>
            <form action={replyTicketAction} className="stack">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <label>Reply<textarea name="body" required rows={3} maxLength={4000} /></label>
              {portal.viewer.role === "admin" ? (
                <label>Status
                  <select name="status" defaultValue={ticket.status}>
                    {TICKET_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
              ) : null}
              <button className="btn" type="submit">Save reply</button>
            </form>
          </article>
        ))}
      </div>
    </PortalFrame>
  );
}
