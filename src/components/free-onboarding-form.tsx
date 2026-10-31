import Link from "next/link";
import { saveFreeHandlesAction, saveFreeNicheAction, saveFreeUploadsAction, skipFreeOnboardingAction } from "@/app/free-actions";
import { CREATOR_NICHES } from "@/lib/creator-niche-shared";
import { activeFreeStep, FREE_ONBOARDING_STEPS, freeOnboardingError, type FreeOnboardingStep, type HandleDraft } from "@/lib/free-onboarding";
import { ONBOARDING_PLATFORMS, onboardingPlatformLabel } from "@/lib/onboarding-fields";

export function FreeOnboardingForm({
  step,
  handles,
  niche,
  nicheOther,
  statNote,
  error,
}: {
  step: FreeOnboardingStep;
  handles: HandleDraft[];
  niche: string;
  nicheOther: string;
  statNote: string;
  error: string | null;
}) {
  const index = FREE_ONBOARDING_STEPS.indexOf(step);
  const selected = new Set(niche.split(",").filter(Boolean));
  const byPlatform = new Map(handles.map((row) => [row.platform, row]));
  return (
    <section className="card stack" data-free-onboarding={step}>
      <p className="eyebrow">Step {index + 1} of 3</p>
      <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={index + 1} aria-label="Onboarding progress">
        <span style={{ width: `${((index + 1) / 3) * 100}%` }} />
      </div>
      {error ? <p className="private-note" role="alert">{error}</p> : null}
      {step === "handles" ? (
        <form action={saveFreeHandlesAction} className="stack">
          <h2>Handles</h2>
          <p>Type the @handle for each platform you use. Leave the rest blank. Counts are optional and stay private.</p>
          {ONBOARDING_PLATFORMS.map((platform) => {
            const saved = byPlatform.get(platform);
            return (
              <fieldset key={platform}>
                <legend>{onboardingPlatformLabel(platform)}</legend>
                <input type="hidden" name="platform" value={platform} />
                <label>@handle <input name={`handle-${platform}`} defaultValue={saved?.handle ?? ""} autoComplete="off" /></label>
                <label>Followers <input name={`followers-${platform}`} inputMode="numeric" defaultValue={saved?.followers ?? ""} /></label>
                <label>Views <input name={`views-${platform}`} inputMode="numeric" defaultValue={saved?.views ?? ""} /></label>
              </fieldset>
            );
          })}
          <button className="btn" type="submit">Next</button>
        </form>
      ) : null}
      {step === "niche" ? (
        <form action={saveFreeNicheAction} className="stack">
          <h2>Niche</h2>
          <p>Pick what you post about. You can choose more than one.</p>
          {CREATOR_NICHES.map((item) => (
            <label key={item.id}>
              <input type="checkbox" name="niche" value={item.id} defaultChecked={selected.has(item.id)} /> {item.label}
            </label>
          ))}
          <label>If you picked Other <input name="nicheOther" defaultValue={nicheOther} /></label>
          <button className="btn" type="submit">Next</button>
        </form>
      ) : null}
      {step === "uploads" ? (
        <form action={saveFreeUploadsAction} className="stack">
          <h2>Upload screenshots and stats</h2>
          <p>Add a screenshot or PDF for one platform, or type a short note about your stats. Files stay private to your account.</p>
          <label>
            Platform
            <select name="platform" defaultValue={handles[0]?.platform ?? "tiktok"}>
              {ONBOARDING_PLATFORMS.map((platform) => <option key={platform} value={platform}>{onboardingPlatformLabel(platform)}</option>)}
            </select>
          </label>
          <label>Screenshot or PDF <input name="stats" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" /></label>
          <label>Stats note <textarea name="statNote" defaultValue={statNote} placeholder="A short note about views or followers. Optional if you upload a file." /></label>
          <button className="btn" type="submit">Next</button>
        </form>
      ) : null}
      <form action={skipFreeOnboardingAction}>
        <button className="btn ghost" type="submit">Skip and finish later</button>
      </form>
      <p className="note">Platform connections stay locked on the free plan. <Link href="/pricing">See Plus, Pro, and Business</Link>.</p>
    </section>
  );
}

export function freeStepFrom(saved: FreeOnboardingStep | "done", requested: string | undefined) {
  return activeFreeStep(saved, requested);
}

export function freeStepError(code: string | undefined) {
  return freeOnboardingError(code);
}
