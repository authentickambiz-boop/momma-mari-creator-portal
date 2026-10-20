import { hideProfileAction, saveProfileAction } from "@/app/profile-actions";
import { PortalFrame } from "@/components/portal-frame";
import { TagPicker } from "@/components/tag-picker";
import { loadPortal } from "@/lib/current-user";
import { BRAND_OPTIONS, FORMAT_OPTIONS, NICHE_CATALOG } from "@/lib/niche-catalog";
import { AGE_RANGES, AUDIENCE_RANGES, US_STATES } from "@/lib/profile-shared";
import { myProfile } from "@/lib/profiles";
import { profileErrorNote } from "@/lib/profile-notes";

function savedList(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; profileError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  if (portal.viewer.role !== "creator" || !portal.viewer.creatorId) {
    const refused = profileErrorNote(params.profileError);
    return (
      <PortalFrame viewer={portal.viewer} tab="directory" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>My profile</h1>}>
        <p className="note">Creators edit their own profile. You can hide a field from Members.</p>
        {refused ? <p className="private-note">{refused}</p> : null}
      </PortalFrame>
    );
  }
  const mine = await myProfile(portal.db, portal.viewer);
  const profile = mine?.profile;
  const preview = mine?.preview;
  const savedNiches = savedList(profile?.niches);
  const savedFormats = savedList(profile?.formats);
  const savedBrands = savedList(profile?.brands);
  const profileError = profileErrorNote(params.profileError);
  return (
    <PortalFrame viewer={portal.viewer} tab="profile" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>My profile</h1><p>Hidden until you turn it on. Others only see the fields you check.</p></div>}>
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {profileError ? <p className="private-note">{profileError}</p> : null}
      <div className="card">
        <div className="sec-title">How others see me</div>
        {preview ? (
          <p>{preview.displayName}{preview.joined ? ` · Joined ${preview.joined}` : ""}{preview.bio ? ` · ${preview.bio}` : ""}</p>
        ) : (
          <p className="note empty">Nothing is public yet.</p>
        )}
        <form action={hideProfileAction}>
          <button className="btn ghost" type="submit">Hide</button>
        </form>
      </div>
      <form action={saveProfileAction} className="card stack">
        <input type="hidden" name="creatorId" value={portal.viewer.creatorId} />
        <label><input type="checkbox" name="profileOn" value="1" defaultChecked={profile?.profileOn} /> Show my profile</label>
        <label>Display name<input name="displayName" defaultValue={profile?.displayName ?? ""} required /></label>
        <label><input type="checkbox" name="displayNameOn" value="1" defaultChecked={profile?.displayNameOn} /> Show display name</label>
        <p className="note">Avatar is your initials. No kids&apos; faces.</p>
        <label><input type="checkbox" name="avatarOn" value="1" defaultChecked={profile?.avatarOn} /> Show initials</label>
        <label>Bio<textarea name="bio" maxLength={280} defaultValue={profile?.bio ?? ""} /></label>
        <label><input type="checkbox" name="bioOn" value="1" defaultChecked={profile?.bioOn} /> Show bio</label>
        <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={savedNiches} placeholder="Search niches" />
        <label><input type="checkbox" name="nichesOn" value="1" defaultChecked={profile?.nichesOn} /> Show niches</label>
        <label>Handles<input name="handles" defaultValue={profile?.handles ?? ""} placeholder="@name" /></label>
        <label><input type="checkbox" name="handlesOn" value="1" defaultChecked={profile?.handlesOn} /> Show handles</label>
        <label>Audience
          <select name="audience" defaultValue={profile?.audience ?? ""}>
            <option value="">Choose a range</option>
            {AUDIENCE_RANGES.map((range) => <option key={range}>{range}</option>)}
          </select>
        </label>
        <label><input type="checkbox" name="audienceOn" value="1" defaultChecked={profile?.audienceOn} /> Show audience range</label>
        <TagPicker name="formats" label="Formats" options={FORMAT_OPTIONS} selected={savedFormats} />
        <label><input type="checkbox" name="formatsOn" value="1" defaultChecked={profile?.formatsOn} /> Show formats</label>
        <label>Ask me about<input name="askMe" defaultValue={profile?.askMe ?? ""} /></label>
        <label><input type="checkbox" name="askMeOn" value="1" defaultChecked={profile?.askMeOn} /> Show ask me about</label>
        <label><input type="checkbox" name="collabs" value="1" defaultChecked={profile?.collabs} /> Open to collabs</label>
        <label><input type="checkbox" name="collabsOn" value="1" defaultChecked={profile?.collabsOn} /> Show collabs</label>
        <label>State
          <select name="state" defaultValue={profile?.state ?? ""}>
            <option value="">State only</option>
            {US_STATES.map((code) => <option key={code}>{code}</option>)}
          </select>
        </label>
        <label><input type="checkbox" name="stateOn" value="1" defaultChecked={profile?.stateOn} /> Show state</label>
        <TagPicker name="brands" label="Brands, names only" options={BRAND_OPTIONS} selected={savedBrands} placeholder="Search or add a brand" />
        <label><input type="checkbox" name="brandsOn" value="1" defaultChecked={profile?.brandsOn} /> Show brands</label>
        <label>Child&apos;s first name or nickname<input name="childName" defaultValue={profile?.childName ?? ""} /></label>
        <label>Age range
          <select name="childAge" defaultValue={profile?.childAge ?? ""}>
            <option value="">Age range</option>
            {AGE_RANGES.map((range) => <option key={range}>{range}</option>)}
          </select>
        </label>
        <label><input type="checkbox" name="familyConfirm" value="1" /> I confirm this is a first name or nickname and an age range</label>
        <label><input type="checkbox" name="familyOn" value="1" defaultChecked={profile?.familyOn} /> Show family details</label>
        <label><input type="checkbox" name="joinedOn" value="1" defaultChecked={profile?.joinedOn ?? true} /> Show joined month and year</label>
        <button className="btn" type="submit">Save profile</button>
      </form>
    </PortalFrame>
  );
}
