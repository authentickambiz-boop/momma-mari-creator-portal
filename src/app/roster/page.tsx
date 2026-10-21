import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { publicPageMeta } from "@/lib/public-meta";
import { publicRosterFeed } from "@/lib/roster-feed";
import { PUBLIC_ROBOTS, publicRoster, rosterCountLabel } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Creators · Momma Mari",
    description: "Creators on the Momma Mari roster, with follower counts from the portal.",
    path: "/roster",
  }),
  robots: PUBLIC_ROBOTS,
};

export default async function RosterPage() {
  const db = await getDb();
  const roster = await publicRoster(db);
  const feed = await publicRosterFeed(db);
  return (
    <PublicShell title="Creators" lede="This list grows when a creator joins the Momma Mari roster. Pay, email, and private notes stay off this page.">
      {roster.length === 0 ? <p className="note empty">No creators are on the public roster yet.</p> : (
        <>
          <p className="note">{rosterCountLabel(roster.length)}</p>
          {feed.combinedFollowers > 0 ? <p className="note">Combined followers {feed.combinedLabel}.</p> : null}
          <div className="public-grid">
            {roster.map((creator) => (
              <article key={creator.id} className="card">
                <div className="avatar" aria-hidden="true">{creator.initials}</div>
                <h2>{creator.name}</h2>
                <p className="note">On the Momma Mari roster.</p>
              </article>
            ))}
          </div>
        </>
      )}
    </PublicShell>
  );
}
