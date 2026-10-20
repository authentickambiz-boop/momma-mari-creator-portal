import { moderateProfileAction } from "@/app/profile-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { PROFILE_FIELDS } from "@/lib/profile-shared";
import { directoryErrorNote, listPublicProfiles } from "@/lib/profiles";

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; directoryError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const cards = await listPublicProfiles(portal.db);
  const directoryError = directoryErrorNote(params.directoryError);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="directory"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><h1>Members</h1><p>Only what each creator chose to show.</p></div>}
    >
      {params.saved === "1" ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {directoryError ? <p className="private-note">{directoryError} Nothing was emailed.</p> : null}
      {cards.length === 0 ? <p className="note empty">No public profiles yet. Nothing is emailed.</p> : null}
      <div className="stack">
        {cards.map((card) => (
          <article key={card.creatorId} className="card">
            <b>{card.displayName}</b>
            {card.initials ? <span> · {card.initials}</span> : null}
            {card.joined ? <p className="note">Joined {card.joined}</p> : null}
            {card.bio ? <p>{card.bio}</p> : null}
            {card.niches?.length ? <p>{card.niches.join(" · ")}</p> : null}
            {card.handles ? <p>{card.handles}</p> : null}
            {card.audience ? <p>{card.audience}</p> : null}
            {card.formats?.length ? <p>{card.formats.join(", ")}</p> : null}
            {card.askMe ? <p>Ask me about {card.askMe}</p> : null}
            {card.collabs ? <p>Open to collabs</p> : null}
            {card.state ? <p>{card.state}</p> : null}
            {card.brands?.length ? <p>Brands: {card.brands.join(", ")}</p> : null}
            {card.family ? <p>{card.family.name} · {card.family.age}</p> : null}
            {portal.viewer.role === "admin" ? (
              <form action={moderateProfileAction} className="stage-form">
                <input type="hidden" name="creatorId" value={card.creatorId} />
                <label>Field
                  <select name="field" aria-label={`Field for ${card.displayName}`}>
                    {PROFILE_FIELDS.map((field) => <option key={field}>{field}</option>)}
                  </select>
                </label>
                <label>Why<input name="reason" required placeholder="Why this change" /></label>
                <button className="btn ghost" type="submit" name="moderation" value="hide">Hide field</button>
                <button className="btn ghost" type="submit" name="moderation" value="reset">Reset field</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </PortalFrame>
  );
}
