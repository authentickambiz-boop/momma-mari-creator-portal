import Link from "next/link";
import { PrivacyNotice } from "@/components/privacy-notice";
import { TagPicker } from "@/components/tag-picker";
import { INTAKE_GOALS, INTAKE_STEPS, type IntakeStep, type IntakeSubmission } from "@/lib/intake-form";
import { NICHE_CATALOG, PLATFORM_OPTIONS } from "@/lib/niche-catalog";
import { AGE_RANGES, US_STATES } from "@/lib/profile-shared";
import { saveIntakeAction } from "@/app/intake-actions";

const STEP_LABELS: Record<IntakeStep, string> = {
  contact: "Contact",
  address: "Address and state",
  platforms: "Platforms",
  niche: "Niche and goals",
  family: "Family",
  rates: "Rates",
  analytics: "Analytics",
};

function stateOptions() {
  return (
    <>
      <option value="">Choose a state</option>
      {US_STATES.map((code) => <option key={code} value={code}>{code}</option>)}
    </>
  );
}

export function IntakeForm({
  intent,
  step,
  token,
  values,
  hasRates,
  note,
}: {
  intent: "apply" | "bench";
  step: IntakeStep;
  token: string;
  values: IntakeSubmission;
  hasRates: boolean;
  note: string | null;
}) {
  const stepIndex = INTAKE_STEPS.indexOf(step);
  const last = step === "analytics";
  return (
      <form action={saveIntakeAction} id="intake-form" className="card stack public-form">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="step" value={step} />
      <input type="hidden" name="token" value={token} />
      <p className="sec-title">Step {stepIndex + 1} of {INTAKE_STEPS.length}: {STEP_LABELS[step]}</p>
      <ol className="apply-steps">
        {INTAKE_STEPS.map((item, index) => (
          <li key={item}><span>{index + 1}</span><div><strong>{STEP_LABELS[item]}</strong>{item === step ? <p>You are on this step.</p> : null}</div></li>
        ))}
      </ol>
      {note ? <p className="private-note">{note}</p> : null}
      {token ? <p className="note">Draft saved on this device link. Nothing was emailed.</p> : null}

      {step === "contact" ? (
        <>
          <label>Legal name
            <input name="legalName" required autoComplete="name" defaultValue={values.legalName} />
          </label>
          <label>Preferred name
            <input name="preferredName" autoComplete="nickname" defaultValue={values.preferredName} />
          </label>
          <label>Email
            <input name="email" type="email" required autoComplete="email" defaultValue={values.email} />
          </label>
          <label>Phone
            <input name="phone" type="tel" required autoComplete="tel" defaultValue={values.phone} placeholder="10-digit US number" />
          </label>
        </>
      ) : null}

      {step === "address" ? (
        <>
          <label>Street address
            <input name="addressLine1" required autoComplete="address-line1" defaultValue={values.addressLine1} />
          </label>
          <label>Address line 2
            <input name="addressLine2" autoComplete="address-line2" defaultValue={values.addressLine2} />
          </label>
          <label>City
            <input name="city" required autoComplete="address-level2" defaultValue={values.city} />
          </label>
          <label>State
            <select name="addressState" required defaultValue={values.addressState}>{stateOptions()}</select>
          </label>
          <label>ZIP
            <input name="zip" required autoComplete="postal-code" defaultValue={values.zip} placeholder="28202" />
          </label>
          <label>Country
            <select name="country" required defaultValue="United States">
              <option value="United States">United States</option>
            </select>
          </label>
          <label>State of residence
            <select name="stateOfResidence" required defaultValue={values.stateOfResidence}>{stateOptions()}</select>
          </label>
        </>
      ) : null}

      {step === "platforms" ? (
        <>
          <p className="note">Add every platform you post on. At least one row needs a handle and a follower count.</p>
          {Array.from({ length: 6 }, (_, index) => {
            const row = values.platforms[index];
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
                <label>Average views
                  <input name={`views-${index}`} inputMode="numeric" defaultValue={row?.avgViews ?? ""} />
                </label>
              </div>
            );
          })}
        </>
      ) : null}

      {step === "niche" ? (
        <>
          <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={values.niches} placeholder="Search niches" />
          <fieldset>
            <legend>Goals</legend>
            {INTAKE_GOALS.map((goal) => (
              <label key={goal}>
                <input type="checkbox" name="goals" value={goal} defaultChecked={values.goals.includes(goal)} /> {goal}
              </label>
            ))}
          </fieldset>
          <label>Anything else about your goals
            <textarea name="goalsText" rows={3} defaultValue={values.goalsText} />
          </label>
        </>
      ) : null}

      {step === "family" ? (
        <>
          <fieldset>
            <legend>Do kids appear in your content?</legend>
            <label><input type="radio" name="kidsInContent" value="yes" defaultChecked={values.kidsInContent === "yes"} /> Yes</label>
            <label><input type="radio" name="kidsInContent" value="no" defaultChecked={values.kidsInContent === "no"} /> No</label>
          </fieldset>
          <label>How many kids appear
            <input name="kidsCount" inputMode="numeric" defaultValue={values.kidsCount} />
          </label>
          <fieldset>
            <legend>Age ranges only</legend>
            {AGE_RANGES.map((range) => (
              <label key={range}>
                <input type="checkbox" name="kidsAges" value={range} defaultChecked={values.kidsAges.includes(range)} /> {range}
              </label>
            ))}
          </fieldset>
          <p className="note">Age ranges only. Do not add a child&apos;s name or birthday.</p>
          <label>Family notes
            <textarea name="familyNotes" rows={3} defaultValue={values.familyNotes} />
          </label>
        </>
      ) : null}

      {step === "rates" ? (
        <>
          <label>Your rates. Only Kamron sees this.
            <input name="statedRates" autoComplete="off" />
          </label>
          {hasRates ? <p className="note">Rates are already saved. Leave this blank to keep them. They are not shown here.</p> : null}
          <p className="note">This stays on the owner&apos;s side of the portal. It is not shown to brands or on public pages.</p>
        </>
      ) : null}

      {step === "analytics" ? (
        <>
          <fieldset>
            <legend>How should we read your numbers?</legend>
            <label><input type="radio" name="analyticsMode" value="connect" defaultChecked={values.analyticsMode === "connect"} /> I will connect accounts</label>
            <label><input type="radio" name="analyticsMode" value="screenshots" defaultChecked={values.analyticsMode === "screenshots"} /> I will upload screenshots</label>
          </fieldset>
          <p className="note"><Link href="/connect">Connect accounts</Link> after you can sign in. Screenshot uploads need 2 images for each platform, up to 10 MB, JPEG, PNG, WEBP, or GIF.</p>
          {values.platforms.map((row, index) => (
            <fieldset key={`${row.platform}-${row.handle}-${index}`}>
              <legend>{row.platform} {row.handle}</legend>
              <label>Screenshot 1<input type="file" name={`shot-${index}-0`} accept="image/jpeg,image/png,image/webp,image/gif" /></label>
              <label>Screenshot 2<input type="file" name={`shot-${index}-1`} accept="image/jpeg,image/png,image/webp,image/gif" /></label>
            </fieldset>
          ))}
          <label>
            <input type="checkbox" name="consentAccuracy" value="1" /> The details in this application are accurate.
          </label>
        </>
      ) : null}

      <div className="leave-blank" aria-hidden="true">
        <label>Leave this blank
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <PrivacyNotice />
      <button className="btn ghost" type="submit" name="intakeAction" value="save">Save and resume</button>
      {last ? (
        <button className="btn" type="submit" name="intakeAction" value="submit">Submit application</button>
      ) : (
        <button className="btn" type="submit" name="intakeAction" value="next">Continue</button>
      )}
    </form>
  );
}
