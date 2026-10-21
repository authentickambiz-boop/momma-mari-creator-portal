import { classifyThreadAction, markThreadPrivateAction, queueBrandReplyAction } from "@/app/inbox-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { gmailBridgeConnectHref, gmailSyncEnabled, gmailSyncStatusLine, listBridgeAudit, listDealInbox } from "@/lib/gmail-bridge";
import { inboxErrorNote } from "@/lib/inbox-notes";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; connected?: string; reply?: string; error?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const filter = portal.viewer.role === "creator" ? portal.viewer.creatorId : portal.viewedId;
  const threads = await listDealInbox(portal.db, portal.viewer, filter);
  const audit = portal.viewer.role === "admin" ? await listBridgeAudit(portal.db, portal.viewer) : null;
  const connectHref = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? gmailBridgeConnectHref(portal.viewer, portal.viewer.creatorId)
    : null;
  const error = inboxErrorNote(params.error);
  const saved = params.reply === "saved"
    ? "Saved as a draft for Kamron. Nothing was sent."
    : params.reply === "private"
      ? "Saved. A private thread stays off your manager&apos;s list."
      : params.reply === "not_deal"
        ? "Saved. This thread is not a deal, so it is off this list."
        : params.reply === "deal"
          ? "Saved. This thread stays on the list as a deal."
          : params.reply === "labeled"
            ? "Saved. A private mark still keeps the thread off the manager list. Nothing was sent."
            : params.connected === "1"
              ? "That inbox is connected. The token is encrypted. Nothing was sent."
              : null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="inbox"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Deal inbox</h1><p>{gmailSyncStatusLine(portal.viewer.role)}</p></div></div>}
    >
      {saved ? <p className="note">{saved}</p> : null}
      {error ? <p className="private-note">{error} Nothing was sent.</p> : null}
      {portal.viewer.role === "manager" ? (
        <p className="note">You can read brand threads for creators assigned to you. You do not get their Gmail login, and you cannot send from here.</p>
      ) : null}
      {!gmailSyncEnabled() ? <p className="note">Live sync is off.</p> : null}
      {connectHref ? <p><a className="btn" href={connectHref}>Connect Gmail (read only)</a></p> : null}
      {threads.length === 0 ? (
        <div className="card">
          <b>No brand threads yet.</b>
          <p className="note">Personal mail is not copied here. A brand inquiry shows up after the inbox is connected and live sync is on.</p>
        </div>
      ) : (
        <div className="stack">
          {threads.map((thread) => (
            <article key={thread.id} className="card stack">
              <div className="sec-title">{thread.brand}</div>
              <b>{thread.subject}</b>
              <p className="note">{thread.fromEmail} · {thread.creatorName}{thread.private ? " · Private" : ""} · {thread.classification === "not_deal" ? "Not a deal" : thread.classification === "deal" ? "Deal" : "Brand inquiry"}</p>
              <p>{thread.snippet}</p>
              {thread.messages.map((message) => (
                <p key={message.id} className="note">{message.fromEmail}: {message.snippet}</p>
              ))}
              <form action={queueBrandReplyAction} className="stack">
                <input type="hidden" name="threadId" value={thread.id} />
                <label>
                  Reply draft
                  <textarea name="body" rows={4} required placeholder="Hi, thanks for writing..." aria-label={`Reply draft for ${thread.brand}`} />
                </label>
                <p className="note">This stays a draft until Kamron approves it. Nothing is sent.</p>
                <button className="btn" type="submit">Save draft</button>
              </form>
              {portal.viewer.role === "creator" ? (
                <form action={markThreadPrivateAction}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <input type="hidden" name="private" value={thread.private ? "0" : "1"} />
                  <button className="btn ghost" type="submit">{thread.private ? "Show this thread to my manager" : "Keep this thread private"}</button>
                </form>
              ) : null}
              {portal.viewer.role === "admin" ? (
                <div className="stack">
                  <form action={classifyThreadAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input type="hidden" name="creator" value={portal.viewedId} />
                    <input type="hidden" name="classification" value="deal" />
                    <button className="btn ghost" type="submit">This is a deal</button>
                  </form>
                  <form action={classifyThreadAction}>
                    <input type="hidden" name="threadId" value={thread.id} />
                    <input type="hidden" name="creator" value={portal.viewedId} />
                    <input type="hidden" name="classification" value="not_deal" />
                    <button className="btn ghost" type="submit">Not a deal</button>
                  </form>
                  <p className="note">Not a deal takes the thread off this list. Marking it a deal does not show a private thread to a manager.</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {audit?.ok ? (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Mail log</div>
          {audit.entries.length === 0 ? <p className="note">No one has opened a brand thread yet.</p> : (
            <table>
              <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
              <tbody>
                {audit.entries.slice(0, 20).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.createdAt}</td>
                    <td>{entry.actorEmail}</td>
                    <td>{entry.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="note">Managers cannot delete this log. It does not include mailbox tokens.</p>
        </section>
      ) : null}
    </PortalFrame>
  );
}
