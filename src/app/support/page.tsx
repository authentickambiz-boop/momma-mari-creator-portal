import { submitSupportAction } from "@/app/account-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PortalFrame } from "@/components/portal-frame";
import { listSupportMessages } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";
import { supportErrorNote } from "@/lib/account-notes";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ saved?: string; supportError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const notes = await listSupportMessages(portal.db, portal.viewer);
  const supportError = supportErrorNote(params.supportError);
  return (
    <PortalFrame viewer={portal.viewer} tab="support" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Support</h1><p>This stays in the portal. Nothing is emailed until someone sends it on purpose.</p></div>}>
      {params.saved ? <p className="note">Saved in the portal. Nothing was sent.</p> : null}
      {supportError ? <p className="private-note">{supportError}</p> : null}
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
    </PortalFrame>
  );
}
