"use client";

import { finishOnboardingAction } from "@/app/actions";
import { TagPicker } from "@/components/tag-picker";
import { finishErrorNote } from "@/lib/finish-notes";
import { BRAND_OPTIONS, NICHE_CATALOG } from "@/lib/niche-catalog";
import { ONBOARDING_PLATFORMS, onboardingPlatformLabel } from "@/lib/onboarding-fields";

const PLATFORM_LABELS = ONBOARDING_PLATFORMS.map((id) => onboardingPlatformLabel(id));

export function OnboardingWizard({
  creatorName,
  suggestedBotName,
  error,
  emailReady,
  niches,
  platforms,
  brands,
}: {
  creatorName: string;
  suggestedBotName: string;
  error: string | null;
  emailReady: boolean;
  niches: string[];
  platforms: string[];
  brands: string[];
}) {
  return (
    <form action={finishOnboardingAction} className="card wizard">
      <h2>Tell us about your bot</h2>
      <p className="note">Name the bot and fill in the profile. Kids&apos; ages and favorite brands can be left blank. Nothing is emailed from here.</p>
      {emailReady ? null : <p className="private-note">Choose how brand email should work above before you press Finish.</p>}
      {error ? <p className="private-note" role="alert">{finishErrorNote(error) ?? "That profile was not saved. Add a niche, a content style, rates, and at least one platform."}</p> : null}
      <label>
        1. What should we call your bot?
        <input name="botName" defaultValue={suggestedBotName} placeholder={`${creatorName} Bot`} required />
        <span className="note">This is the name you and Kamron will see.</span>
      </label>
      <TagPicker name="niche" label="2. Niche" options={NICHE_CATALOG} selected={niches} placeholder="Search niches" />
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
      <TagPicker name="favoriteBrands" label="6. Favorite brands" options={BRAND_OPTIONS} selected={brands} placeholder="Brands you would say yes to" />
      <TagPicker name="platforms" label="Platforms you post on" options={PLATFORM_LABELS} selected={platforms} />
      <button className="btn" type="submit">Finish</button>
    </form>
  );
}
