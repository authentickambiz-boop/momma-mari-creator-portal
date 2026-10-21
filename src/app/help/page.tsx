import Link from "next/link";
import { openPublicTicketAction } from "@/app/ticket-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PublicShell } from "@/components/public-shell";
import { HELP_ARTICLES, helpArticle, searchHelp } from "@/lib/help-center";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/support-tickets";
import { ticketErrorNote } from "@/lib/ticket-notes";

export const metadata = {
  ...publicPageMeta({
    title: "Momma Mari help",
    description: "Help for creators, brands, payments, privacy, and kids in content.",
    path: "/help",
  }),
  robots: PUBLIC_ROBOTS,
};

function ArticleBody({ body }: { body: string }) {
  return body.split(/\n\n+/).map((block) => <p key={block.slice(0, 40)}>{block}</p>);
}

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string; saved?: string; ticketError?: string }> }) {
  const params = await searchParams;
  const articles = searchHelp(params.q ?? "");
  const note = ticketErrorNote(params.ticketError);
  return (
    <PublicShell title="Help" lede="Short guides. A ticket stays in the portal. Nothing is emailed.">
      <form method="get" className="card stack">
        <label>Search
          <input name="q" defaultValue={params.q ?? ""} placeholder="payments, privacy, kids" />
        </label>
        <button className="btn ghost" type="submit">Search</button>
      </form>
      {articles.length === 0 ? <p className="note">No matching guide. Try another word, or open a ticket below.</p> : (
        <div className="public-grid">
          {articles.map((article) => (
            <article key={article.slug} className="card">
              <h2><Link href={`/help/${article.slug}`}>{article.title}</Link></h2>
              <p>{article.audience}</p>
            </article>
          ))}
        </div>
      )}
      <h2>Open a ticket</h2>
      <p>Use this if you are not signed in. Sign in and open Support to see your own thread.</p>
      {params.saved ? <p className="note">Saved in the portal. Nothing was emailed.</p> : null}
      {note ? <p className="private-note">{note}</p> : null}
      <form action={openPublicTicketAction} className="card stack">
        <label>Name<input name="name" required autoComplete="name" maxLength={120} /></label>
        <label>Email<input name="email" type="email" required autoComplete="email" maxLength={160} /></label>
        <label>Category
          <select name="category" required defaultValue="">
            <option value="">Choose one</option>
            {TICKET_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>Priority
          <select name="priority" required defaultValue="Normal">
            {TICKET_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </label>
        <label>Subject<input name="subject" required maxLength={140} /></label>
        <label>Message<textarea name="body" required rows={5} maxLength={4000} /></label>
        <div className="leave-blank" aria-hidden="true">
          <label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <PrivacyNotice />
        <button className="btn" type="submit">Save ticket</button>
      </form>
      <p className="note">Guides: {HELP_ARTICLES.map((article) => article.title).join(", ")}. {helpArticle("privacy") ? "Privacy is one of them." : ""}</p>
    </PublicShell>
  );
}
