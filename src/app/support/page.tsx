import { submitSupportAction } from "@/app/account-actions";
import { PortalFrame } from "@/components/portal-frame";
import { listSupportMessages } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ saved?: string; supportError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const notes = await listSupportMessages(portal.db, portal.viewer);
  return (
    <PortalFrame viewer={portal.viewer} tab="support" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Support</h1><p>This stays in the portal. Nothing is emailed until someone sends it on purpose.</p></div>}>
      {params.saved ? <p className="note">Saved in the portal. Nothing was sent.</p> : null}
      {params.supportError ? <p className="private-note">{params.supportError}</p> : null}
      <form action={submitSupportAction} className="card stack">
        <label>Subject<input name="subject" required maxLength={140} /></label>
        <label>Message<textarea name="body" required rows={5} maxLength={4000} /></label>
        <button className="btn" type="submit">Save note</button>
      </form>
      {notes.length > 0 ? (
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
      ) : null}
    </PortalFrame>
  );
}
