import Link from "next/link";
import { clearProfileHoldAction, moderateProfileAction } from "@/app/profile-actions";
import { MemberProfile } from "@/components/member-profile";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { PROFILE_FIELDS } from "@/lib/profile-shared";
import { directoryErrorNote, memberProfile } from "@/lib/profiles";
import { safetyLabel } from "@/lib/safety-shared";

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creator?: string; saved?: string; directoryError?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(query.creator ?? null);
  const card = await memberProfile(portal.db, portal.viewer, id);
  const directoryError = directoryErrorNote(query.directoryError);
  const owner = portal.viewer.role === "admin";
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="directory"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><h1>{card?.displayName ?? "Member"}</h1><p>A profile from the circle.</p></div>}
    >
      <p className="note"><Link href="/directory">Back to Members</Link></p>
      {query.saved === "1" ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {directoryError ? <p className="private-note">{directoryError} Nothing was emailed.</p> : null}
      {!card ? <p className="note empty">This profile is not on Members.</p> : null}
      {card ? <MemberProfile card={card} /> : null}
      {card && owner && card.safetyKinds?.length ? (
        <p className="private-note">Held for Kamron: {card.safetyKinds.map((kind) => safetyLabel(kind)).join(", ")}. Members cannot see this profile.</p>
      ) : null}
      {card && owner && card.photoHeld ? <p className="private-note">The photos are held for Kamron. Members cannot see them.</p> : null}
      {card && owner && card.hiddenFields?.length ? <p className="note">Hidden from members: {card.hiddenFields.join(", ")}.</p> : null}
      {card && owner ? (
        <form action={moderateProfileAction} className="card stage-form">
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
      {card && owner && card.safetyKinds?.length ? (
        <form action={clearProfileHoldAction} className="card stage-form">
          <input type="hidden" name="creatorId" value={card.creatorId} />
          <input type="hidden" name="hold" value="text" />
          <label>Why this can show<input name="reason" required placeholder="Why this can show" /></label>
          <button className="btn" type="submit">Clear text hold</button>
        </form>
      ) : null}
      {card && owner && card.photoHeld ? (
        <form action={clearProfileHoldAction} className="card stage-form">
          <input type="hidden" name="creatorId" value={card.creatorId} />
          <input type="hidden" name="hold" value="photo" />
          <label>Why the photos can show<input name="reason" required placeholder="Why the photos can show" /></label>
          <button className="btn" type="submit">Clear photo hold</button>
        </form>
      ) : null}
    </PortalFrame>
  );
}
