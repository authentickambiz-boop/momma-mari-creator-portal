import { MemberCard } from "@/components/member-profile";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { directoryErrorNote, listDirectoryProfiles } from "@/lib/profiles";

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; directoryError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const cards = await listDirectoryProfiles(portal.db, portal.viewer);
  const directoryError = directoryErrorNote(params.directoryError);
  const owner = portal.viewer.role === "admin";
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="directory"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><h1>Members</h1><p>{owner ? "Open any profile, including hidden ones and ones held for review." : "Only what each creator chose to show. Tap a card to open the profile."}</p></div>}
    >
      {params.saved === "1" ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {directoryError ? <p className="private-note">{directoryError} Nothing was emailed.</p> : null}
      {cards.length === 0 ? <p className="note empty">No public profiles yet. Nothing is emailed.</p> : null}
      <div className="member-grid">
        {cards.map((card) => <MemberCard key={card.creatorId} card={card} />)}
      </div>
    </PortalFrame>
  );
}
