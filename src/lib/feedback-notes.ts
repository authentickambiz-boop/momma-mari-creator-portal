import { FEEDBACK_ERRORS } from "./feedback";

const FEEDBACK_NOTES = {
  ...FEEDBACK_ERRORS,
  "1": "That was not saved. Nothing was emailed.",
} as const;

export function feedbackErrorCode(error: string) {
  const match = (Object.keys(FEEDBACK_ERRORS) as (keyof typeof FEEDBACK_ERRORS)[])
    .find((code) => FEEDBACK_ERRORS[code] === error);
  return match ?? "1";
}

export function feedbackErrorNote(code: string | undefined) {
  if (!code) return null;
  return FEEDBACK_NOTES[code as keyof typeof FEEDBACK_NOTES] ?? FEEDBACK_NOTES["1"];
}
