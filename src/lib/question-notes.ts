const QUESTION_ERROR_TEXT = {
  signin: "Creators fill this in on their own sign-in.",
  step: "That step is not part of the questionnaire.",
  ages: "Confirm the age ranges, or skip this step.",
  required: "This step is required.",
  bot: "Finish the bot questions on this step.",
  niches: "Pick at least one niche.",
  nicheMax: "Pick up to 5.",
  nicheList: "Pick a niche from the list.",
  nicheOther: "Other can be 40 characters.",
  viewers: "Average viewers has to be a whole number.",
  hours: "Hours per week has to be a whole number.",
  proof: "Analytics proof uses an http or https link.",
  followers: "Enter a follower count as a whole number.",
  platforms: "Pick at least one platform.",
  audience: "Choose an audience size.",
  formats: "Pick at least one format.",
  frequency: "Choose how often you post.",
  rates: "Add at least one rate.",
  brands: "Add a brand you have worked with.",
  availability: "Add your availability and turnaround.",
  shipping: "Choose a shipping region.",
  languages: "Pick at least one language.",
} as const;

export const QUESTION_NOTES: Record<string, string> = {
  ...QUESTION_ERROR_TEXT,
  "1": "That was not saved.",
};

export function questionErrorCode(error: string) {
  const match = (Object.keys(QUESTION_ERROR_TEXT) as (keyof typeof QUESTION_ERROR_TEXT)[])
    .find((code) => QUESTION_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A code from the URL. Unknown wording becomes the fixed fallback, never the query text. */
export function questionErrorNote(code: string | undefined) {
  if (!code) return null;
  return QUESTION_NOTES[code] ?? QUESTION_NOTES["1"];
}
