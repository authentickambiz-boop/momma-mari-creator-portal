import { MeetCreators } from "@/components/meet-creators";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { MEET_LABEL, publicMeetCreators } from "@/lib/public-creators";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  title: "Meet Our Creators · Momma Mari",
  description: "Creators on the Momma Mari roster, with bios and the latest weekly numbers.",
  robots: PUBLIC_ROBOTS,
};

export default async function MeetPage() {
  const db = await getDb();
  const creators = await publicMeetCreators(db);
  return (
    <PublicShell title={MEET_LABEL} lede="Photos are of the creators. Numbers come from the weekly import. A number that was not in that import is left off.">
      <MeetCreators creators={creators} />
    </PublicShell>
  );
}
