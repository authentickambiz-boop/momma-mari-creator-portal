import Link from "next/link";
import { hideProfileAction, saveProfileAction } from "@/app/profile-actions";
import { MemberProfile } from "@/components/member-profile";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PortalFrame } from "@/components/portal-frame";
import { ProfileCrop } from "@/components/profile-crop";
import { RankBadge } from "@/components/rank-badge";
import { TagPicker } from "@/components/tag-picker";
import { loadPortal } from "@/lib/current-user";
import { memberImageSrc, parseStoredPins, parseStoredPlatforms, storedSafetyKinds } from "@/lib/member-profile";
import { BRAND_OPTIONS, FORMAT_OPTIONS, NICHE_CATALOG } from "@/lib/niche-catalog";
import { AGE_RANGES, AUDIENCE_RANGES, MEMBER_PLATFORMS, US_STATES } from "@/lib/profile-shared";
import { myProfile } from "@/lib/profiles";
import { profileErrorNote } from "@/lib/profile-notes";
import { safetyLabel } from "@/lib/safety-shared";

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
  const platforms = parseStoredPlatforms(profile?.platformsJson);
  const pins = parseStoredPins(profile?.pinsJson);
  const holds = storedSafetyKinds(profile?.safetyKinds);
  const profileError = profileErrorNote(params.profileError);
  const handleFor = (platform: string) => platforms.find((item) => item.platform === platform)?.handle ?? "";
  return (
    <PortalFrame viewer={portal.viewer} tab="profile" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>My profile</h1><p>A checked field is visible to members. An unchecked field stays hidden. Your rank is added for you.</p></div>}>
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {profileError ? <p className="private-note">{profileError}</p> : null}
      {holds.length ? <p className="private-note">Held for Kamron: {holds.map((kind) => safetyLabel(kind)).join(", ")}. Members cannot see this profile until the hold is cleared.</p> : null}
      {profile?.photoHold ? <p className="private-note">Your photos are held for Kamron. Members cannot see them until the hold is cleared.</p> : null}
      <p className="note"><Link href="/profile/intake">Complete your profile</Link> saves your legal name, mailing address, phone, and handles for your contract. Nothing is emailed.</p>
      <div className="card">
        <div className="sec-title">How members see me</div>
        <RankBadge score={mine?.rankScore ?? 0} />
        {preview ? <MemberProfile card={preview} /> : <p className="note empty">Nothing is on Members yet.</p>}
        <form action={hideProfileAction}>
          <button className="btn ghost" type="submit">Hide</button>
        </form>
      </div>
      <form action={saveProfileAction} className="card stack">
        <input type="hidden" name="creatorId" value={portal.viewer.creatorId} />
        <label><input type="checkbox" name="profileOn" value="1" defaultChecked={profile?.profileOn} /> Show my profile</label>
        <p className="note">A school logo, house number, address, or child&apos;s full name holds the profile for Kamron. The matched words are not shown on the hold.</p>
        <ProfileCrop name="avatarFile" label="Profile picture" shape="avatar" existingSrc={memberImageSrc(profile?.avatarImage)} removeName="removeAvatar" />
        <label><input type="checkbox" name="avatarOn" value="1" defaultChecked={profile?.avatarOn} /> Show profile picture</label>
        <ProfileCrop name="coverFile" label="Cover banner" shape="cover" existingSrc={memberImageSrc(profile?.coverImage)} removeName="removeCover" />
        <label><input type="checkbox" name="coverOn" value="1" defaultChecked={profile?.coverOn} /> Show cover</label>
        <label><input type="checkbox" name="photoHold" value="1" defaultChecked={profile?.photoHold} disabled={Boolean(profile?.photoHold)} /> This photo shows a school logo, a house number, or a child&apos;s face</label>
        <label>Display name<input name="displayName" defaultValue={profile?.displayName ?? ""} required /></label>
        <label><input type="checkbox" name="displayNameOn" value="1" defaultChecked={profile?.displayNameOn} /> Show display name</label>
        <label>Bio<textarea name="bio" maxLength={160} defaultValue={profile?.bio ?? ""} /></label>
        <label><input type="checkbox" name="bioOn" value="1" defaultChecked={profile?.bioOn} /> Show bio</label>
        <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={savedNiches} placeholder="Search niches" />
        <label><input type="checkbox" name="nichesOn" value="1" defaultChecked={profile?.nichesOn} /> Show niches</label>
        <fieldset className="member-fields">
          <legend>Platforms</legend>
          {MEMBER_PLATFORMS.map((platform) => (
            <label key={platform}>{platform}
              <input name={`platform-${platform}`} defaultValue={handleFor(platform)} placeholder="@handle" />
            </label>
          ))}
        </fieldset>
        <label><input type="checkbox" name="platformsOn" value="1" defaultChecked={profile?.platformsOn} /> Show platforms</label>
        <label>Handles<input name="handles" defaultValue={profile?.handles ?? ""} placeholder="@name" /></label>
        <label><input type="checkbox" name="handlesOn" value="1" defaultChecked={profile?.handlesOn} /> Show handles</label>
        <fieldset className="member-fields">
          <legend>Pinned posts</legend>
          {[0, 1, 2].map((index) => {
            const pin = pins[index];
            return (
              <div key={index} className="member-pin-edit">
                <label>Link
                  <input name={`pinUrl${index}`} type="url" defaultValue={pin?.url ?? ""} placeholder="https://" />
                </label>
                <label>Title
                  <input name={`pinTitle${index}`} defaultValue={pin?.title ?? ""} maxLength={80} />
                </label>
                <ProfileCrop name={`pinThumb${index}`} label={`Thumbnail ${index + 1}`} shape="pin" existingSrc={memberImageSrc(pin?.thumb)} removeName={`removePinThumb${index}`} />
              </div>
            );
          })}
        </fieldset>
        <label><input type="checkbox" name="pinsOn" value="1" defaultChecked={profile?.pinsOn} /> Show pinned posts</label>
        <label>Favorite snack<input name="snack" maxLength={40} defaultValue={profile?.snack ?? ""} /></label>
        <label><input type="checkbox" name="snackOn" value="1" defaultChecked={profile?.snackOn} /> Show favorite snack</label>
        <label>Currently loving<input name="loving" maxLength={40} defaultValue={profile?.loving ?? ""} /></label>
        <label><input type="checkbox" name="lovingOn" value="1" defaultChecked={profile?.lovingOn} /> Show currently loving</label>
        <label>Weekend plan<input name="weekend" maxLength={40} defaultValue={profile?.weekend ?? ""} /></label>
        <label><input type="checkbox" name="weekendOn" value="1" defaultChecked={profile?.weekendOn} /> Show weekend plan</label>
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
        <p className="note">Messages aren&apos;t open yet.</p>
        <PrivacyNotice />
        <button className="btn" type="submit">Save profile</button>
      </form>
    </PortalFrame>
  );
}
