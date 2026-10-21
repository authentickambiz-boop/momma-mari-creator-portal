import Link from "next/link";
import { saveProfileIntakeAction } from "@/app/profile-intake-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { ensureProfileIntakeTask } from "@/lib/creator-tasks";
import { PLATFORM_OPTIONS } from "@/lib/niche-catalog";
import { loadProfileIntake } from "@/lib/profile-intake";
import { profileIntakeErrorNote } from "@/lib/profile-intake-notes";
import { US_STATES } from "@/lib/profile-shared";
import { creatorStartPath } from "@/lib/questionnaire";

export default async function ProfileIntakePage({ searchParams }: { searchParams: Promise<{ saved?: string; intakeError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null, { allowIncompleteProfile: true });
  const note = profileIntakeErrorNote(params.intakeError);
  if (portal.viewer.role !== "creator" || !portal.viewer.creatorId) {
    return (
      <PortalFrame viewer={portal.viewer} tab="profile" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Complete your profile</h1>}>
        <p className="note">Creators complete their own profile.</p>
        {note ? <p className="private-note">{note}</p> : null}
      </PortalFrame>
    );
  }
  await ensureProfileIntakeTask(portal.db, portal.viewer.creatorId);
  const savedForm = await loadProfileIntake(portal.db, portal.viewer);
  const handles = savedForm?.handles ?? [];
  const next = await creatorStartPath(portal.db, portal.viewer);
  return (
    <PortalFrame viewer={portal.viewer} tab="profile" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Complete your profile</h1><p>Legal name, mailing address, phone, and handles for your contract. Nothing is emailed.</p></div>}>
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {note ? <p className="private-note">{note}</p> : null}
      <form action={saveProfileIntakeAction} className="card stack">
        <p className="note">Account email: {savedForm?.email}</p>
        <label>Legal name
          <input name="legalName" required autoComplete="name" defaultValue={savedForm?.legalName ?? ""} />
        </label>
        <label>Phone
          <input name="phone" type="tel" required autoComplete="tel" defaultValue={savedForm?.phone ?? ""} placeholder="10-digit US number" />
        </label>
        <label>Street address
          <input name="addressLine1" required autoComplete="address-line1" defaultValue={savedForm?.addressLine1 ?? ""} />
        </label>
        <label>Address line 2
          <input name="addressLine2" autoComplete="address-line2" defaultValue={savedForm?.addressLine2 ?? ""} />
        </label>
        <label>City
          <input name="city" required autoComplete="address-level2" defaultValue={savedForm?.city ?? ""} />
        </label>
        <label>State
          <select name="addressState" required defaultValue={savedForm?.addressState ?? ""}>
            <option value="">Choose a state</option>
            {US_STATES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label>ZIP
          <input name="zip" required autoComplete="postal-code" defaultValue={savedForm?.zip ?? ""} />
        </label>
        <label>Country
          <select name="country" required defaultValue={savedForm?.country || "United States"}>
            <option>United States</option>
          </select>
        </label>
        <p className="sec-title">Handles</p>
        <p className="note">Add every platform you post on.</p>
        {Array.from({ length: 6 }, (_, index) => {
          const row = handles[index];
          return (
            <div key={index} className="stage-form">
              <label>Platform
                <select name={`platform-${index}`} defaultValue={row?.platform ?? ""}>
                  <option value="">None</option>
                  {PLATFORM_OPTIONS.map((platform) => <option key={platform}>{platform}</option>)}
                </select>
              </label>
              <label>Handle
                <input name={`handle-${index}`} defaultValue={row?.handle ?? ""} placeholder="@name" />
              </label>
              <label>Profile URL
                <input name={`url-${index}`} defaultValue={row?.url ?? ""} placeholder="https://" />
              </label>
              <label>Followers
                <input name={`followers-${index}`} inputMode="numeric" defaultValue={row?.followers ?? ""} />
              </label>
            </div>
          );
        })}
        <PrivacyNotice />
        <button className="btn" type="submit">Save profile details</button>
      </form>
      {params.saved && next !== "/profile/intake" ? <p><Link href={next}>Continue into the portal</Link></p> : null}
    </PortalFrame>
  );
}
