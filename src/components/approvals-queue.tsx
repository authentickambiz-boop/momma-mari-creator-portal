import { reviewApprovalAction } from "@/app/actions";
import type { ApprovalQueueItem } from "@/lib/approvals";
import { withBasePath } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  created: "Drafted",
  edited: "Edited",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Sent",
};

export function ApprovalsQueue({
  items,
  creatorQuery,
  error,
}: {
  items: ApprovalQueueItem[];
  creatorQuery: string;
  error: boolean;
}) {
  const waiting = items.filter((item) => item.status === "pending");
  const decided = items.filter((item) => item.status !== "pending");
  return (
    <div className="stack">
      {error ? <p className="private-note">That change was not saved. Nothing was sent.</p> : null}
      {waiting.length === 0 ? (
        <div className="card">
          <b>Nothing is waiting.</b>
          <p className="note">When a creator says they are interested or passes, or the bot drafts an email to a brand, it shows up here first. Nothing is sent until you approve it.</p>
        </div>
      ) : (
        waiting.map((item) => <ApprovalCard key={item.id} item={item} creatorQuery={creatorQuery} />)
      )}
      {decided.length > 0 ? (
        <section>
          <div className="sec-title">Already decided</div>
          <div className="stack">
            {decided.map((item) => <ApprovalCard key={item.id} item={item} creatorQuery={creatorQuery} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ApprovalCard({ item, creatorQuery }: { item: ApprovalQueueItem; creatorQuery: string }) {
  const waiting = item.status === "pending";
  const canReject = item.status === "pending" || item.status === "approved";
  return (
    <article className="card approval">
      <div className="top">
        <span className="name">{item.gateLabel}</span>
        <span className="chip c-sun">{item.statusLabel}</span>
      </div>
      <p className="note">{item.creatorName} · {item.brand}</p>
      <p className="note">From {item.fromEmail} · To {item.toEmail}</p>
      {item.copies.length > 0 ? (
        <div className="private-note">
          <div className="sec-title">Saved copy</div>
          {item.copies.map((copy) => (
            <p key={copy.id}>
              {copy.kind === "sent" ? "Sent copy" : "Approved copy"}
              {" · "}
              <a href={withBasePath(`/api/deals/${item.dealId}/emails/${copy.id}/file`)}>Copy kept in the portal</a>
              {copy.stored === "drive" && copy.driveFileUrl ? (
                <> · <a href={copy.driveFileUrl}>Open in Drive</a> (04 Emails)</>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}
      {item.attachmentNote || item.attachmentUrl ? (
        <p className="note">
          Attachment: {item.attachmentNote ?? "File"}
          {item.attachmentUrl ? <> · <a href={item.attachmentUrl}>Open</a></> : null}
        </p>
      ) : null}
      {item.gate === "decline" ? (
        <div className="private-note">
          <div className="sec-title">Saved only if you approve</div>
          <p>
            Brand contact: {[item.brandContactName, item.brandContactEmail, item.brandContactCompany].filter(Boolean).join(" · ") || "Not set"}
          </p>
          <p>
            Suggest instead: {item.suggestedCreatorName ?? "No other creator"}
            {item.suggestedPlan ? ` · ${item.suggestedPlan}` : ""}
          </p>
          <p className="note">This note stays with us. It is not added to the email unless you write it into the text.</p>
        </div>
      ) : null}
      {waiting ? (
        <form action={reviewApprovalAction} className="approval-form">
          <input type="hidden" name="approvalId" value={item.id} />
          {creatorQuery ? <input type="hidden" name="creator" value={creatorQuery} /> : null}
          <label>
            Subject
            <input type="text" name="subject" defaultValue={item.subject} required />
          </label>
          <label>
            Email
            <textarea name="body" defaultValue={item.body} required />
          </label>
          <label>
            Note for the history
            <input type="text" name="note" placeholder="Optional. Only you see this." />
          </label>
          <div className="approval-actions">
            <button className="btn" type="submit" name="intent" value="approve">Approve</button>
            <button className="btn ghost" type="submit" name="intent" value="edit">Save edit</button>
            <button className="btn ghost" type="submit" name="intent" value="reject">Reject</button>
          </div>
        </form>
      ) : (
        <>
          <h3>{item.subject}</h3>
          <p className="email-body">{item.body}</p>
          {item.gmailMessageId ? <p className="note">Sent message {item.gmailMessageId}</p> : null}
          {canReject ? (
            <form action={reviewApprovalAction} className="approval-actions">
              <input type="hidden" name="approvalId" value={item.id} />
              {creatorQuery ? <input type="hidden" name="creator" value={creatorQuery} /> : null}
              <input type="text" name="note" placeholder="Why this should not go out" aria-label="Note" />
              <button className="btn ghost" type="submit" name="intent" value="reject">Reject before it sends</button>
            </form>
          ) : null}
        </>
      )}
      {item.events.length > 0 ? (
        <div className="private-note">
          <div className="sec-title">History</div>
          <ul className="timeline">
            {item.events.map((event) => (
              <li key={event.id}>
                <div className="when">{event.createdAt.slice(0, 16).replace("T", " ")} · {ACTION_LABEL[event.action] ?? event.action} · {event.actorEmail}</div>
                {event.note ? <div>{event.note}</div> : null}
                {event.subject || event.body ? (
                  <details>
                    <summary>Text at this step</summary>
                    {event.subject ? <div><b>{event.subject}</b></div> : null}
                    {event.body ? <div className="email-body">{event.body}</div> : null}
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
