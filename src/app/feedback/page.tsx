import { saveFeedbackAction } from "@/app/feedback-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { FEEDBACK_CATEGORIES, listFeedback } from "@/lib/feedback";
import { feedbackErrorNote } from "@/lib/feedback-notes";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Momma Mari feedback",
    description: "Tell Momma Mari what is working. The note stays in the portal.",
    path: "/feedback",
  }),
  robots: PUBLIC_ROBOTS,
};

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ saved?: string; feedbackError?: string; category?: string; rating?: string }> }) {
  const params = await searchParams;
  const note = feedbackErrorNote(params.feedbackError);
  const viewer = await currentViewer();
  const db = await getDb();
  const rows = await listFeedback(db, viewer, { category: params.category, rating: params.rating });
  return (
    <PublicShell title="Feedback" lede="Category, a rating, and what happened. This is saved in the portal. Nothing is emailed.">
      {params.saved ? <p className="note">Saved in the portal. Nothing was emailed.</p> : null}
      {note ? <p className="private-note">{note}</p> : null}
      <form action={saveFeedbackAction} className="card stack">
        <label>Category
          <select name="category" required defaultValue="">
            <option value="">Choose one</option>
            {FEEDBACK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Rating</legend>
          {["1", "2", "3", "4", "5"].map((score) => (
            <label key={score}><input type="radio" name="rating" value={score} required /> {score}</label>
          ))}
        </fieldset>
        <label>What happened
          <textarea name="body" required rows={5} maxLength={4000} />
        </label>
        <label>Name
          <input name="name" autoComplete="name" maxLength={120} defaultValue={viewer?.name ?? ""} />
        </label>
        <label>Email, if we may reply in the portal
          <input name="email" type="email" autoComplete="email" maxLength={160} defaultValue={viewer?.email ?? ""} />
        </label>
        <label><input type="checkbox" name="followUp" value="1" /> Kamron may follow up</label>
        <div className="leave-blank" aria-hidden="true">
          <label>Leave this blank
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <PrivacyNotice />
        <button className="btn" type="submit">Save feedback</button>
      </form>
      {viewer?.role === "admin" ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Notes in the portal</div>
          <form method="get" className="stage-form">
            <label>Category
              <select name="category" defaultValue={params.category ?? ""}>
                <option value="">All</option>
                {FEEDBACK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>Rating
              <select name="rating" defaultValue={params.rating ?? ""}>
                <option value="">All</option>
                {["1", "2", "3", "4", "5"].map((score) => <option key={score}>{score}</option>)}
              </select>
            </label>
            <button className="btn ghost" type="submit">Filter</button>
          </form>
          {rows.length === 0 ? <p className="note empty">No notes yet. Nothing is emailed.</p> : (
            <ul className="timeline">
              {rows.map((row) => (
                <li key={row.id}>
                  <b>{row.category} · {row.rating}</b>
                  <div className="note">{row.authorName || "Anonymous"}{row.followUp ? " · Follow up" : ""} · {row.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </PublicShell>
  );
}
