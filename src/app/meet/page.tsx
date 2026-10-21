import Link from "next/link";
import { MeetCreators } from "@/components/meet-creators";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { publicPageMeta } from "@/lib/public-meta";
import { MEET_LABEL, publicMeetCreators } from "@/lib/public-creators";
import { publicRosterFeed } from "@/lib/roster-feed";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Meet Our Creators · Momma Mari",
    description: "Creators on the Momma Mari roster, with bios and the latest weekly numbers.",
    path: "/meet",
  }),
  robots: PUBLIC_ROBOTS,
};

export default async function MeetPage() {
  const db = await getDb();
  const creators = await publicMeetCreators(db);
  const feed = await publicRosterFeed(db);
  return (
    <PublicShell title={MEET_LABEL} lede="Photos are of the creators. Numbers come from the weekly import. A number that was not in that import is left off.">
      {feed.combinedFollowers > 0 ? <p className="note">Combined followers {feed.combinedLabel}.</p> : null}
      <MeetCreators creators={creators} />
      <p><Link href="/work">Brands the roster has worked with</Link></p>
    </PublicShell>
  );
}
