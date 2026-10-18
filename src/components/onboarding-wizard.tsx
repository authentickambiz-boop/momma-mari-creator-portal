"use client";

import { finishOnboardingAction } from "@/app/actions";
import { ONBOARDING_PLATFORMS, onboardingPlatformLabel } from "@/lib/onboarding-fields";

export function OnboardingWizard({
  creatorName,
  suggestedBotName,
  error,
}: {
  creatorName: string;
  suggestedBotName: string;
  error: boolean;
}) {
  return (
    <form action={finishOnboardingAction} className="card wizard">
      <h2>Tell us about your bot</h2>
      <p className="note">Name the bot and fill in the profile. Kids&apos; ages and favorite brands can be left blank. Nothing is emailed from here.</p>
      {error ? <p className="private-note">That profile was not saved. Add a niche, a content style, rates, and at least one platform.</p> : null}
      <label>
        1. What should we call your bot?
        <input name="botName" defaultValue={suggestedBotName} placeholder={`${creatorName} Bot`} required />
        <span className="note">This is the name you and Kamron will see.</span>
      </label>
      <label>
        2. Niche
        <input name="niche" placeholder="Mom life, home, wellness" required />
      </label>
      <label>
        3. Content style
        <textarea name="contentStyle" placeholder="Short talking-to-camera videos, warm and practical." required />
      </label>
      <label>
        4. Kids&apos; ages <span className="note">optional</span>
        <input name="kidsAges" placeholder="Leave blank if you don't want this on file" />
      </label>
      <label>
        5. Rates
        <textarea name="rates" placeholder="$500 for one TikTok. Usage fees extra." required />
      </label>
      <label>
        6. Favorite brands <span className="note">optional</span>
        <textarea name="favoriteBrands" placeholder="Brands you would say yes to" />
      </label>
      <fieldset>
        <legend>Platforms you post on</legend>
        {ONBOARDING_PLATFORMS.map((id) => (
          <label key={id} className="check">
            <input type="checkbox" name="platforms" value={id} />
            {onboardingPlatformLabel(id)}
          </label>
        ))}
      </fieldset>
      <button className="btn" type="submit">Finish</button>
    </form>
  );
}
